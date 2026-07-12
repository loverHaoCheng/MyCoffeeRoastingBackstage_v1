import { AI_FEATURE_BEAN_IMAGE_RECOGNITION, AI_USAGE_LIMITS_COLLECTION, AI_USAGE_LOGS_COLLECTION, DEFAULT_AI_USAGE_LIMIT, superuserCollection } from '../config.js';
import { normalizeAuthResponse, proxyPocketBaseRequest } from '../pocketbase-client.js';
import { escapeFilterValue, getFirstListItem, listPocketBaseRecords, listRecordIdsByFilter } from '../record-utils.js';
import { AiUsageLimitRecord, AiUsageState, PocketBaseGatewayError } from '../types.js';

export const formatShanghaiMonth = (date: Date): string => {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
};

export const getConfiguredSuperuserCredentials = (): { email: string; password: string } | null => {
  const email = (process.env.PB_SUPERUSER_EMAIL ?? '').trim();
  const password = (process.env.PB_SUPERUSER_PASSWORD ?? '').trim();

  if (!email || !password) {
    return null;
  }

  return {
    email,
    password,
  };
};

export const getRequiredSuperuserToken = async (): Promise<string> => {
  const credentials = getConfiguredSuperuserCredentials();

  if (!credentials) {
    throw new PocketBaseGatewayError(500, {
      message: '服务器未配置 PocketBase 管理员账号，无法使用 AI 识别。',
    });
  }

  const upstream = await proxyPocketBaseRequest(`/api/collections/${superuserCollection}/auth-with-password`, {
    body: JSON.stringify({
      identity: credentials.email,
      password: credentials.password,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!upstream.response.ok) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }

  const authResponse = normalizeAuthResponse(upstream.payload);

  if (!authResponse) {
    throw new PocketBaseGatewayError(502, {
      message: 'PocketBase 管理员登录响应缺少必要字段。',
    });
  }

  return authResponse.token;
};

export const getOptionalSuperuserToken = async (): Promise<null | string> => {
  if (!getConfiguredSuperuserCredentials()) {
    return null;
  }

  return getRequiredSuperuserToken();
};

export const normalizeMonthlyLimit = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : DEFAULT_AI_USAGE_LIMIT;
};

export const getAiUsageLimit = async (
  superuserToken: string,
  ownerId: string,
  feature: string,
): Promise<{ enabled: boolean; monthlyLimit: number }> => {
  const payload = await listPocketBaseRecords(superuserToken, AI_USAGE_LIMITS_COLLECTION, {
    fields: 'enabled,monthly_limit',
    filter: `owner = ${escapeFilterValue(ownerId)} && feature = ${escapeFilterValue(feature)}`,
    perPage: 1,
  });
  const record = getFirstListItem(payload) as AiUsageLimitRecord | null;

  if (!record) {
    return {
      enabled: true,
      monthlyLimit: DEFAULT_AI_USAGE_LIMIT,
    };
  }

  return {
    enabled: record.enabled !== false,
    monthlyLimit: normalizeMonthlyLimit(record.monthly_limit),
  };
};

export const countSuccessfulAiUsage = async (
  superuserToken: string,
  ownerId: string,
  feature: string,
  month: string,
): Promise<number> => {
  const recordIds = await listRecordIdsByFilter(
    superuserToken,
    AI_USAGE_LOGS_COLLECTION,
    [
      `owner = ${escapeFilterValue(ownerId)}`,
      `feature = ${escapeFilterValue(feature)}`,
      `month = ${escapeFilterValue(month)}`,
      `status = ${escapeFilterValue('success')}`,
    ].join(' && '),
  );

  return recordIds.length;
};

export const createAiUsageLog = async (
  superuserToken: string,
  input: {
    errorMessage?: string;
    feature: string;
    month: string;
    ownerId: string;
    status: 'failed' | 'success';
  },
): Promise<void> => {
  const now = new Date().toISOString();
  const upstream = await proxyPocketBaseRequest(`/api/collections/${AI_USAGE_LOGS_COLLECTION}/records`, {
    body: JSON.stringify({
      created_at: now,
      error_message: input.errorMessage ?? '',
      feature: input.feature,
      month: input.month,
      owner: input.ownerId,
      status: input.status,
      updated_at: now,
    }),
    headers: {
      Accept: 'application/json',
      Authorization: superuserToken,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!upstream.response.ok) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }
};

export const logAiRecognitionFailure = async (
  superuserToken: string,
  input: {
    errorMessage: string;
    month: string;
    ownerId: string;
  },
): Promise<void> => {
  await createAiUsageLog(superuserToken, {
    errorMessage: input.errorMessage.slice(0, 500),
    feature: AI_FEATURE_BEAN_IMAGE_RECOGNITION,
    month: input.month,
    ownerId: input.ownerId,
    status: 'failed',
  }).catch(() => {
    // 失败日志不能影响原始错误返回；成功日志则必须写入后才会扣次。
  });
};

export const readBeanImageRecognitionUsageState = async (
  superuserToken: string,
  ownerId: string,
  month: string,
): Promise<AiUsageState> => {
  const usageLimit = await getAiUsageLimit(superuserToken, ownerId, AI_FEATURE_BEAN_IMAGE_RECOGNITION);
  const usedThisMonth = await countSuccessfulAiUsage(
    superuserToken,
    ownerId,
    AI_FEATURE_BEAN_IMAGE_RECOGNITION,
    month,
  );

  return {
    enabled: usageLimit.enabled,
    monthlyLimit: usageLimit.monthlyLimit,
    remainingUses: usageLimit.enabled ? Math.max(usageLimit.monthlyLimit - usedThisMonth, 0) : 0,
    usedThisMonth,
  };
};
