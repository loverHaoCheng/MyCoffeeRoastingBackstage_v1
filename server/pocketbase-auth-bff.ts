import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

interface PocketBaseSessionResponse {
  record: SessionUser;
  token: string;
}

interface ClientSessionResponse {
  record: SessionUser;
}

interface PocketBaseErrorPayload {
  data?: Record<string, unknown>;
  message?: string;
}

interface PocketBaseUserRecord {
  email?: unknown;
  id?: unknown;
  name?: unknown;
  verified?: unknown;
  username?: unknown;
}

interface SessionUser {
  email: string;
  id: string;
  name?: string;
  verified?: boolean;
  username?: string;
}

interface EmailActionResult {
  message: string;
  success: true;
}

interface AccountDeletionResult {
  message: string;
  success: true;
}

interface BeanImageRecognitionResult {
  altitudeMetersMax: null | number;
  altitudeMetersMin: null | number;
  code: string;
  densityGPerL: null | number;
  displayName: string;
  flavorTags: string[];
  grade: string;
  harvestSeason: string;
  millName: string;
  moisturePercent: null | number;
  notes: string;
  originArea: string;
  originCountry: string;
  originRegion: string;
  processMethod: string;
  supplierName: string;
  variety: string;
}

class PocketBaseGatewayError extends Error {
  payload: unknown;
  status: number;

  constructor(status: number, payload: unknown, message?: string) {
    super(message ?? `PocketBase 请求失败：${String(status)}`);
    this.name = 'PocketBaseGatewayError';
    this.payload = payload;
    this.status = status;
  }
}

interface PocketBaseListResponseItem {
  id?: unknown;
}

interface AiUsageLimitRecord {
  enabled?: unknown;
  monthly_limit?: unknown;
}

interface AiUsageState {
  enabled: boolean;
  monthlyLimit: number;
  remainingUses: number;
  usedThisMonth: number;
}

const DEFAULT_POCKETBASE_URL = 'https://www.easybake.top';
const DEFAULT_AUTH_COLLECTION = 'users';
const DEFAULT_AUTH_COOKIE_NAME = 'easybake_pb_session';
const DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_PORT = 3001;
const DEFAULT_SUPERUSER_COLLECTION = '_superusers';
const DEFAULT_AI_USAGE_LIMIT = 10;
const DEFAULT_AI_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
const AI_FEATURE_BEAN_IMAGE_RECOGNITION = 'bean_image_recognition';
const AI_USAGE_LIMITS_COLLECTION = 'ai_usage_limits';
const AI_USAGE_LOGS_COLLECTION = 'ai_usage_logs';
const QINIU_DEFAULT_BASE_URL = 'https://api.qnaigc.com/v1';
const QINIU_DEFAULT_MODEL = 'qwen/qwen3.6-27b';
const BUSINESS_COLLECTIONS = new Set([
  'app_settings',
  'bean_sale_specs',
  'cost_calculations',
  'finance_expense_records',
  'green_beans',
  'green_bean_purchase_batches',
  'roast_batches',
  'roast_profiles',
  'roast_records',
]);
const REALTIME_SUBSCRIPTIONS = new Set([
  'app_settings/*',
  'bean_sale_specs/*',
  'green_beans/*',
  'green_bean_purchase_batches/*',
  'roast_batches/*',
  'roast_profiles/*',
]);

const normalizeBaseUrl = (value: string, fallback: string): string => {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed.replace(/\/+$/, '') : fallback;
};

const authCollection = (process.env.PB_AUTH_COLLECTION ?? DEFAULT_AUTH_COLLECTION).trim() || DEFAULT_AUTH_COLLECTION;
const superuserCollection =
  (process.env.PB_SUPERUSER_COLLECTION ?? DEFAULT_SUPERUSER_COLLECTION).trim() || DEFAULT_SUPERUSER_COLLECTION;
const authCookieName =
  (process.env.PB_AUTH_COOKIE_NAME ?? DEFAULT_AUTH_COOKIE_NAME).trim() || DEFAULT_AUTH_COOKIE_NAME;
const cookieMaxAgeCandidate = Number.parseInt(
  (process.env.PB_AUTH_COOKIE_MAX_AGE_SECONDS ?? String(DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS)).trim(),
  10,
);
const cookieMaxAgeSeconds =
  Number.isFinite(cookieMaxAgeCandidate) && cookieMaxAgeCandidate >= 0
    ? cookieMaxAgeCandidate
    : DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS;
const pocketBaseBaseUrl = normalizeBaseUrl(process.env.PB_BASE_URL ?? DEFAULT_POCKETBASE_URL, DEFAULT_POCKETBASE_URL);
const portCandidate = Number.parseInt((process.env.PORT ?? String(DEFAULT_PORT)).trim(), 10);
const port = Number.isFinite(portCandidate) && portCandidate > 0 ? portCandidate : DEFAULT_PORT;
const aiImageMaxBytesCandidate = Number.parseInt(
  (process.env.AI_IMAGE_MAX_BYTES ?? String(DEFAULT_AI_IMAGE_MAX_BYTES)).trim(),
  10,
);
const aiImageMaxBytes =
  Number.isFinite(aiImageMaxBytesCandidate) && aiImageMaxBytesCandidate > 0
    ? aiImageMaxBytesCandidate
    : DEFAULT_AI_IMAGE_MAX_BYTES;
const qiniuQwenBaseUrl = normalizeBaseUrl(process.env.QINIU_QWEN_BASE_URL ?? QINIU_DEFAULT_BASE_URL, QINIU_DEFAULT_BASE_URL);
const qiniuQwenModel = (process.env.QINIU_QWEN_MODEL ?? QINIU_DEFAULT_MODEL).trim() || QINIU_DEFAULT_MODEL;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value != null;
};

const toTrimmedString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const buildPocketBaseUrl = (path: string): string => {
  return new URL(path, `${pocketBaseBaseUrl}/`).toString();
};

const parseJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunkValue of request) {
    const chunk: unknown = chunkValue;

    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    }
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('请求体不是有效的 JSON。');
  }
};

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const rawBody = await response.text();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
};

const readRequestBuffer = async (
  request: IncomingMessage,
  options: {
    maxBytes: number;
  },
): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunkValue of request) {
    const chunk =
      typeof chunkValue === 'string'
        ? Buffer.from(chunkValue)
        : chunkValue instanceof Uint8Array
          ? Buffer.from(chunkValue)
          : Buffer.alloc(0);

    receivedBytes += chunk.byteLength;

    if (receivedBytes > options.maxBytes) {
      throw new Error('图片数据过大，请压缩到 6MB 以内后重试。');
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

const parseLimitedJsonBody = async (
  request: IncomingMessage,
  options: {
    maxBytes: number;
  },
): Promise<unknown> => {
  const rawBody = (await readRequestBuffer(request, options)).toString('utf8').trim();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('请求体不是有效的 JSON。');
  }
};

const sendApiSuccess = (response: ServerResponse, data: unknown): void => {
  sendJson(response, 200, {
    code: 0,
    data,
    message: 'ok',
  });
};

const sendApiError = (
  response: ServerResponse,
  statusCode: number,
  message: string,
  data: Record<string, unknown> = {},
): void => {
  sendJson(response, statusCode, {
    code: statusCode,
    data,
    message,
  });
};

const buildQiniuQwenUrl = (path: string): string => {
  return new URL(path.replace(/^\//, ''), `${qiniuQwenBaseUrl}/`).toString();
};

const formatShanghaiMonth = (date: Date): string => {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
};

const getConfiguredSuperuserCredentials = (): { email: string; password: string } | null => {
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

const getRequiredSuperuserToken = async (): Promise<string> => {
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

const getOptionalSuperuserToken = async (): Promise<null | string> => {
  if (!getConfiguredSuperuserCredentials()) {
    return null;
  }

  return getRequiredSuperuserToken();
};

const normalizeMonthlyLimit = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : DEFAULT_AI_USAGE_LIMIT;
};

const listPocketBaseRecords = async (
  token: string,
  collectionName: string,
  options: {
    fields?: string;
    filter?: string;
    page?: number;
    perPage?: number;
  } = {},
): Promise<unknown> => {
  const searchParams = new URLSearchParams({
    fields: options.fields ?? 'id',
    page: String(options.page ?? 1),
    perPage: String(options.perPage ?? 200),
  });

  if (options.filter) {
    searchParams.set('filter', options.filter);
  }

  const upstream = await proxyPocketBaseRequest(
    `/api/collections/${collectionName}/records?${searchParams.toString()}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: token,
      },
      method: 'GET',
    },
  );

  if (!upstream.response.ok) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }

  return upstream.payload;
};

const getFirstListItem = (payload: unknown): Record<string, unknown> | null => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return null;
  }

  const firstItem = payload.items[0] as unknown;

  return isRecord(firstItem) ? firstItem : null;
};

const getAiUsageLimit = async (
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

const countSuccessfulAiUsage = async (
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

const createAiUsageLog = async (
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

const parseImageRecognitionRequest = async (request: IncomingMessage): Promise<{ imageDataUrl: string }> => {
  const contentType = request.headers['content-type'] ?? '';
  const normalizedContentType = Array.isArray(contentType) ? '' : contentType.toLowerCase();
  const binaryImageMimeTypeMatch = /^image\/(?:jpeg|jpg|png|webp)(?:\s*;.*)?$/.exec(normalizedContentType);

  if (binaryImageMimeTypeMatch) {
    const binaryImage = await readRequestBuffer(request, {
      maxBytes: aiImageMaxBytes,
    });

    if (binaryImage.byteLength <= 0) {
      throw new Error('图片内容为空，请重新上传。');
    }

    return {
      imageDataUrl: `data:${normalizedContentType.split(';')[0]};base64,${binaryImage.toString('base64')}`,
    };
  }

  if (!normalizedContentType.includes('application/json')) {
    throw new Error('请使用 JSON 请求体或 jpeg、png、webp 二进制图片提交图片数据。');
  }

  const body = await parseLimitedJsonBody(request, {
    maxBytes: Math.ceil(aiImageMaxBytes * 1.5) + 2048,
  });

  if (!isRecord(body)) {
    throw new Error('AI 图片识别请求缺少有效参数。');
  }

  const imageDataUrl = toTrimmedString(body.imageDataUrl);
  const imageBase64 = toTrimmedString(body.imageBase64);
  const mimeType = toTrimmedString(body.mimeType) || 'image/jpeg';
  const normalizedDataUrl = imageDataUrl || `data:${mimeType};base64,${imageBase64}`;
  const dataUrlMatch = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(normalizedDataUrl);

  if (!dataUrlMatch) {
    throw new Error('请提交 jpeg、png 或 webp 格式的 base64 图片。');
  }

  const binaryImage = Buffer.from(dataUrlMatch[2].replaceAll(/\s/g, ''), 'base64');

  if (binaryImage.byteLength <= 0) {
    throw new Error('图片内容为空，请重新上传。');
  }

  if (binaryImage.byteLength > aiImageMaxBytes) {
    throw new Error('图片数据过大，请压缩到 6MB 以内后重试。');
  }

  return {
    imageDataUrl: `data:${dataUrlMatch[1]};base64,${binaryImage.toString('base64')}`,
  };
};

const getOptionalStringField = (record: Record<string, unknown>, fieldName: string): string => {
  return typeof record[fieldName] === 'string' ? record[fieldName].trim() : '';
};

const getOptionalNumberField = (record: Record<string, unknown>, fieldName: string): null | number => {
  const value = record[fieldName];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
};

const normalizeFlavorTagList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, 12);
};

const normalizeHarvestSeasonShortYear = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const fullYearMatch = /(?:19|20)\d{2}/.exec(trimmed);

  if (fullYearMatch) {
    return fullYearMatch[0].slice(-2);
  }

  const twoDigitMatch = /\d{2}/.exec(trimmed);

  return twoDigitMatch ? twoDigitMatch[0] : trimmed;
};

const normalizeRecognitionPayload = (payload: unknown): BeanImageRecognitionResult | null => {
  if (!isRecord(payload)) {
    return null;
  }

  return {
    altitudeMetersMax: getOptionalNumberField(payload, 'altitudeMetersMax'),
    altitudeMetersMin: getOptionalNumberField(payload, 'altitudeMetersMin'),
    code: getOptionalStringField(payload, 'code'),
    densityGPerL: getOptionalNumberField(payload, 'densityGPerL'),
    displayName: getOptionalStringField(payload, 'displayName'),
    flavorTags: normalizeFlavorTagList(payload.flavorTags),
    grade: getOptionalStringField(payload, 'grade'),
    harvestSeason: normalizeHarvestSeasonShortYear(getOptionalStringField(payload, 'harvestSeason')),
    millName: getOptionalStringField(payload, 'millName'),
    moisturePercent: getOptionalNumberField(payload, 'moisturePercent'),
    notes: getOptionalStringField(payload, 'notes'),
    originArea: getOptionalStringField(payload, 'originArea'),
    originCountry: getOptionalStringField(payload, 'originCountry'),
    originRegion: getOptionalStringField(payload, 'originRegion'),
    processMethod: getOptionalStringField(payload, 'processMethod'),
    supplierName: getOptionalStringField(payload, 'supplierName'),
    variety: getOptionalStringField(payload, 'variety'),
  };
};

const parseJsonCandidate = (candidate: string): unknown => {
  const normalizedCandidate = candidate
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(normalizedCandidate) as unknown;
};

const extractBalancedJsonObject = (text: string): string => {
  const startIndex = text.indexOf('{');

  if (startIndex < 0) {
    return '';
  }

  let depth = 0;
  let isEscaped = false;
  let isInString = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      isInString = !isInString;
      continue;
    }

    if (isInString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return '';
};

const extractJsonFromModelText = (text: string): unknown => {
  const trimmedText = text.trim();
  const fencedJsonMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmedText);
  const candidates = [
    fencedJsonMatch?.[1] ?? '',
    trimmedText,
    extractBalancedJsonObject(trimmedText),
  ].filter((candidate) => candidate.trim().length > 0);

  for (const candidate of candidates) {
    const balancedCandidate = candidate.trim().startsWith('{')
      ? candidate
      : extractBalancedJsonObject(candidate);

    if (!balancedCandidate) {
      continue;
    }

    try {
      return parseJsonCandidate(balancedCandidate);
    } catch {
      // 继续尝试其他候选片段；最终统一抛出业务错误。
    }
  }

  throw new Error('AI 返回内容不是有效的 JSON。');
};

const getContentPartText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (!isRecord(value)) {
    return '';
  }

  const text = toTrimmedString(value.text) || toTrimmedString(value.output_text);

  if (text) {
    return text;
  }

  if ('code' in value || 'displayName' in value || 'originCountry' in value) {
    return JSON.stringify(value);
  }

  return '';
};

const getModelContentText = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }

  const directOutputText = getContentPartText(payload.output_text);

  if (directOutputText) {
    return directOutputText;
  }

  if (!Array.isArray(payload.choices)) {
    return '';
  }

  for (const choice of payload.choices) {
    if (!isRecord(choice)) {
      continue;
    }

    const choiceText = getContentPartText(choice.text);

    if (choiceText) {
      return choiceText;
    }

    if (!isRecord(choice.message)) {
      continue;
    }

    const content = choice.message.content;

    if (Array.isArray(content)) {
      const joinedContent = content
        .map((part) => getContentPartText(part))
        .filter((part) => part.length > 0)
        .join('\n')
        .trim();

      if (joinedContent) {
        return joinedContent;
      }
    }

    const contentText = getContentPartText(content);

    if (contentText) {
      return contentText;
    }

    const reasoningContent = getContentPartText(choice.message.reasoning_content);

    if (reasoningContent) {
      return reasoningContent;
    }
  }

  return '';
};

const getModelResponseDiagnostics = (payload: unknown): string => {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return 'choices:missing';
  }

  const firstChoice = payload.choices[0] as unknown;

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return 'message:missing';
  }

  const finishReason = toTrimmedString(firstChoice.finish_reason);
  const messageKeys = Object.keys(firstChoice.message).sort().join(',');
  const content = firstChoice.message.content;
  const contentType = Array.isArray(content) ? 'array' : typeof content;

  return [
    finishReason ? `finish_reason:${finishReason}` : '',
    messageKeys ? `message_keys:${messageKeys}` : '',
    `content_type:${contentType}`,
  ].filter((item) => item.length > 0).join('；') || 'unknown';
};

const getQiniuErrorMessage = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }

  const directMessage = toTrimmedString(payload.message);

  if (directMessage) {
    return directMessage;
  }

  if (isRecord(payload.error)) {
    return toTrimmedString(payload.error.message) || toTrimmedString(payload.error.code);
  }

  return toTrimmedString(payload.code) || toTrimmedString(payload.error);
};

const formatQiniuRequestError = (status: number, payload: unknown, action: string): string => {
  const upstreamMessage = getQiniuErrorMessage(payload);
  const suffix = upstreamMessage ? `上游信息：${upstreamMessage}` : '上游未返回可读错误信息。';

  if (status === 401 || status === 403) {
    return (
      `七牛云 Qwen ${action}被拒绝：${String(status)}。` +
      `请检查 QINIU_QWEN_API_KEY 是否有效且已开通当前模型，` +
      `QINIU_QWEN_MODEL=${qiniuQwenModel} 是否与七牛云控制台模型 ID 完全一致，` +
      `以及该模型是否允许当前账号调用视觉/多模态能力。${suffix}`
    );
  }

  return `七牛云 Qwen ${action}失败：${String(status)}。${suffix}`;
};

const requestQiniuJsonRepair = async (apiKey: string, modelText: string): Promise<unknown> => {
  const upstream = await fetch(buildQiniuQwenUrl('/chat/completions'), {
    body: JSON.stringify({
      enable_thinking: false,
      max_tokens: 1024,
      messages: [
        {
          content:
            '你是严格 JSON 格式化器。把用户提供的咖啡生豆识别文本转换成一个 JSON 对象。不要解释，不要 Markdown，不要输出 JSON 以外的任何内容。',
          role: 'system',
        },
        {
          content:
            `请只返回这些字段：code, displayName, originCountry, originRegion, originArea, processMethod, variety, grade, harvestSeason, millName, flavorTags, altitudeMetersMin, altitudeMetersMax, moisturePercent, densityGPerL, supplierName, notes。\n` +
            '字符串字段无法确认时返回空字符串；数值字段无法确认时返回 null；flavorTags 返回字符串数组；harvestSeason 只返回年份后两位，例如 2026 返回 26。\n\n' +
            `待整理文本：\n${modelText.slice(0, 6000)}`,
          role: 'user',
        },
      ],
      model: qiniuQwenModel,
      temperature: 0,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await parseJsonResponse(upstream);

  if (!upstream.ok) {
    throw new Error(formatQiniuRequestError(upstream.status, payload, 'JSON 整理'));
  }

  const contentText = getModelContentText(payload);

  if (!contentText) {
    throw new Error(`AI JSON 整理返回内容为空（${getModelResponseDiagnostics(payload)}）。`);
  }

  return extractJsonFromModelText(contentText);
};

const requestQiniuBeanImageRecognition = async (imageDataUrl: string): Promise<BeanImageRecognitionResult> => {
  const apiKey = (process.env.QINIU_QWEN_API_KEY ?? '').trim();

  if (!apiKey) {
    throw new Error('服务器未配置七牛云 Qwen API Key。');
  }

  const upstream = await fetch(buildQiniuQwenUrl('/chat/completions'), {
    body: JSON.stringify({
      enable_thinking: false,
      max_tokens: 2048,
      messages: [
        {
          content:
            '你是咖啡生豆标签识别助手。只根据图片内容提取字段，无法确认的字段返回空字符串、空数组或 null。必须只输出一个 JSON 对象，不要输出解释，不要使用 Markdown 代码块。',
          role: 'system',
        },
        {
          content: [
            {
              text:
                '识别这张生豆标签、袋标或采购单图片，返回一个 JSON 对象，字段固定为：code, displayName, originCountry, originRegion, originArea, processMethod, variety, grade, harvestSeason, millName, flavorTags, altitudeMetersMin, altitudeMetersMax, moisturePercent, densityGPerL, supplierName, notes。数值字段只返回数字或 null；flavorTags 返回字符串数组；harvestSeason 只返回年份后两位，例如 2026 返回 26；没有识别到的字符串字段返回空字符串。',
              type: 'text',
            },
            {
              image_url: {
                url: imageDataUrl,
              },
              type: 'image_url',
            },
          ],
          role: 'user',
        },
      ],
      model: qiniuQwenModel,
      temperature: 0.1,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await parseJsonResponse(upstream);

  if (!upstream.ok) {
    throw new Error(formatQiniuRequestError(upstream.status, payload, '请求'));
  }

  const contentText = getModelContentText(payload);

  if (!contentText) {
    throw new Error(`AI 返回内容为空（${getModelResponseDiagnostics(payload)}）。`);
  }

  let recognitionPayload: unknown;

  try {
    recognitionPayload = extractJsonFromModelText(contentText);
  } catch {
    recognitionPayload = await requestQiniuJsonRepair(apiKey, contentText);
  }

  const normalizedRecognition = normalizeRecognitionPayload(recognitionPayload);

  if (!normalizedRecognition) {
    throw new Error('AI 返回字段格式不符合要求。');
  }

  return normalizedRecognition;
};

const normalizeUser = (record: PocketBaseUserRecord): SessionUser | null => {
  const id = toTrimmedString(record.id);
  const email = toTrimmedString(record.email);

  if (!id || !email) {
    return null;
  }

  return {
    email,
    id,
    name: toTrimmedString(record.name) || undefined,
    verified: typeof record.verified === 'boolean' ? record.verified : undefined,
    username: toTrimmedString(record.username) || undefined,
  };
};

const normalizeAuthResponse = (payload: unknown): PocketBaseSessionResponse | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const token = toTrimmedString(payload.token);
  const record = isRecord(payload.record) ? (payload.record as PocketBaseUserRecord) : null;

  if (!token || !record) {
    return null;
  }

  const user = normalizeUser(record);

  if (!user) {
    return null;
  }

  return {
    record: user,
    token,
  };
};

const normalizeErrorPayload = (payload: unknown): PocketBaseErrorPayload => {
  if (!isRecord(payload)) {
    return {};
  }

  return {
    data: isRecord(payload.data) ? payload.data : undefined,
    message: toTrimmedString(payload.message) || undefined,
  };
};

const normalizeListResponse = (payload: unknown): { items: { id: string }[]; totalPages: number } | null => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return null;
  }

  const items = payload.items
    .map((item) => {
      const record = isRecord(item) ? (item as PocketBaseListResponseItem) : null;
      const id = record ? toTrimmedString(record.id) : '';

      return id ? { id } : null;
    })
    .filter((item): item is { id: string } => item != null);
  const totalPages =
    typeof payload.totalPages === 'number' && Number.isFinite(payload.totalPages) && payload.totalPages > 0
      ? Math.floor(payload.totalPages)
      : 1;

  return {
    items,
    totalPages,
  };
};

const hasSecureForwardedProto = (request: IncomingMessage): boolean => {
  if (process.env.PB_AUTH_COOKIE_SECURE === 'true') {
    return true;
  }

  const forwardedProto = request.headers['x-forwarded-proto'];

  if (Array.isArray(forwardedProto)) {
    return forwardedProto.some((value) => value.trim().toLowerCase() === 'https');
  }

  return typeof forwardedProto === 'string' && forwardedProto.trim().toLowerCase() === 'https';
};

const serializeCookie = (
  name: string,
  value: string,
  options: {
    maxAgeSeconds?: number;
    secure?: boolean;
  } = {},
): string => {
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (typeof options.maxAgeSeconds === 'number' && Number.isFinite(options.maxAgeSeconds)) {
    segments.push(`Max-Age=${String(Math.max(0, Math.floor(options.maxAgeSeconds)))}`);
  }

  if (options.secure) {
    segments.push('Secure');
  }

  return segments.join('; ');
};

const parseCookies = (headerValue: string | string[] | undefined): Record<string, string> => {
  if (typeof headerValue !== 'string' || headerValue.trim().length === 0) {
    return {};
  }

  return Object.fromEntries(
    headerValue.split(';').map((entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex < 0) {
        return [entry.trim(), ''];
      }

      const cookieName = entry.slice(0, separatorIndex).trim();
      const cookieValue = entry.slice(separatorIndex + 1).trim();

      try {
        return [cookieName, decodeURIComponent(cookieValue)];
      } catch {
        return [cookieName, cookieValue];
      }
    }),
  );
};

const getAuthCookieValue = (request: IncomingMessage): string => {
  const cookies = parseCookies(request.headers.cookie);

  return cookies[authCookieName] ?? '';
};

const setAuthCookie = (response: ServerResponse, request: IncomingMessage, token: string): void => {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(authCookieName, token, {
      maxAgeSeconds: cookieMaxAgeSeconds,
      secure: hasSecureForwardedProto(request),
    }),
  );
};

const clearAuthCookie = (response: ServerResponse, request: IncomingMessage): void => {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(authCookieName, '', {
      maxAgeSeconds: 0,
      secure: hasSecureForwardedProto(request),
    }),
  );
};

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): void => {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(body));
};

const sendMethodNotAllowed = (response: ServerResponse, allowedMethods: string[]): void => {
  sendJson(
    response,
    405,
    {
      message: 'Method Not Allowed',
    },
    {
      Allow: allowedMethods.join(', '),
    },
  );
};

const sendUpstreamError = (response: ServerResponse, statusCode: number, payload: unknown): void => {
  const normalizedError = normalizeErrorPayload(payload);
  const message =
    normalizedError.message && normalizedError.message.length > 0
      ? normalizedError.message
      : `PocketBase 请求失败：${String(statusCode)}`;

  sendJson(response, statusCode, {
    ...normalizedError,
    message,
  });
};

const sendClientSession = (response: ServerResponse, statusCode: number, record: SessionUser): void => {
  sendJson(response, statusCode, {
    record,
  } satisfies ClientSessionResponse);
};

const proxyPocketBaseRequest = async (
  path: string,
  init: RequestInit,
): Promise<{ payload: unknown; response: Response }> => {
  const response = await fetch(buildPocketBaseUrl(path), init);
  const payload = await parseJsonResponse(response);

  return {
    payload,
    response,
  };
};

const getAuthenticatedToken = (request: IncomingMessage, response: ServerResponse): string | null => {
  const token = getAuthCookieValue(request);

  if (token) {
    return token;
  }

  clearAuthCookie(response, request);
  sendJson(response, 401, {
    message: '未找到登录态，请重新登录。',
  });
  return null;
};

const handleBusinessCollectionRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<boolean> => {
  const match = /^\/api\/collections\/([^/]+)\/records(?:\/([^/]+))?$/.exec(requestUrl.pathname);

  if (!match) {
    return false;
  }

  const collectionName = decodeURIComponent(match[1]);

  if (!BUSINESS_COLLECTIONS.has(collectionName)) {
    sendJson(response, 404, {
      message: 'Not Found',
    });
    return true;
  }

  if (!['DELETE', 'GET', 'PATCH', 'POST'].includes(request.method ?? '')) {
    sendMethodNotAllowed(response, ['DELETE', 'GET', 'PATCH', 'POST']);
    return true;
  }

  const token = getAuthenticatedToken(request, response);

  if (!token) {
    return true;
  }

  const method = request.method ?? 'GET';
  const body = method === 'GET' || method === 'DELETE' ? null : await parseJsonBody(request);
  const upstream = await proxyPocketBaseRequest(`${requestUrl.pathname}${requestUrl.search}`, {
    body: body == null ? undefined : JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      Authorization: token,
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
    },
    method,
  });

  if (!upstream.response.ok) {
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return true;
  }

  sendJson(response, upstream.response.status === 204 ? 200 : upstream.response.status, upstream.payload);
  return true;
};

const handleRealtimeRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const token = getAuthenticatedToken(request, response);

  if (!token) {
    return;
  }

  if (request.method === 'POST') {
    const body = await parseJsonBody(request);

    if (!isRecord(body) || typeof body.clientId !== 'string' || !Array.isArray(body.subscriptions)) {
      sendJson(response, 400, {
        message: '实时订阅请求缺少有效参数。',
      });
      return;
    }

    const clientId = toTrimmedString(body.clientId);
    const subscriptions = body.subscriptions.filter(
      (item): item is string => typeof item === 'string' && REALTIME_SUBSCRIPTIONS.has(item),
    );

    if (!clientId || subscriptions.length !== body.subscriptions.length) {
      sendJson(response, 400, {
        message: '实时订阅包含不支持的主题。',
      });
      return;
    }

    const upstream = await proxyPocketBaseRequest('/api/realtime', {
      body: JSON.stringify({
        clientId,
        subscriptions,
      }),
      headers: {
        Accept: 'application/json',
        Authorization: token,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!upstream.response.ok) {
      sendUpstreamError(response, upstream.response.status, upstream.payload);
      return;
    }

    sendJson(response, 200, upstream.payload);
    return;
  }

  if (request.method !== 'GET') {
    sendMethodNotAllowed(response, ['GET', 'POST']);
    return;
  }

  const controller = new AbortController();
  response.once('close', () => {
    controller.abort();
  });
  const upstream = await fetch(buildPocketBaseUrl('/api/realtime'), {
    headers: {
      Accept: 'text/event-stream',
      Authorization: token,
    },
    method: 'GET',
    signal: controller.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const payload = await parseJsonResponse(upstream);
    sendUpstreamError(response, upstream.status, payload);
    return;
  }

  response.writeHead(upstream.status, {
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
    'X-Accel-Buffering': 'no',
  });
  Readable.fromWeb(upstream.body).pipe(response);
};

const requestEmailAction = async (
  action: 'request-password-reset' | 'request-verification',
  email: string,
): Promise<{ payload: unknown; response: Response }> => {
  return proxyPocketBaseRequest(`/api/collections/${authCollection}/${action}`, {
    body: JSON.stringify({
      email,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
};

const sendUnverifiedResponse = (
  response: ServerResponse,
  request: IncomingMessage,
  email: string,
): void => {
  clearAuthCookie(response, request);
  sendJson(response, 403, {
    code: 'EMAIL_NOT_VERIFIED',
    email,
    message: '该邮箱尚未完成验证，请先前往邮箱完成验证后再登录。',
  });
};

const toGenericEmailActionResult = (message: string): EmailActionResult => ({
  message,
  success: true,
});

const toAccountDeletionResult = (message: string): AccountDeletionResult => ({
  message,
  success: true,
});

const escapeFilterValue = (value: string): string => {
  return `'${value.replaceAll("'", "\\'")}'`;
};

const buildRecordListPath = (
  collectionName: string,
  options: {
    filter?: string;
    page?: number;
    perPage?: number;
  } = {},
): string => {
  const searchParams = new URLSearchParams({
    fields: 'id',
    page: String(options.page ?? 1),
    perPage: String(options.perPage ?? 200),
  });

  if (options.filter) {
    searchParams.set('filter', options.filter);
  }

  return `/api/collections/${collectionName}/records?${searchParams.toString()}`;
};

const isOptionalCollectionMissing = (statusCode: number, payload: unknown): boolean => {
  if (statusCode === 404) {
    return true;
  }

  const message = normalizeErrorPayload(payload).message?.trim().toLowerCase() ?? '';

  return message.includes('not found') || message.includes('missing');
};

const listRecordIdsByFilter = async (
  token: string,
  collectionName: string,
  filter: string,
): Promise<string[]> => {
  const recordIds: string[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const upstream = await proxyPocketBaseRequest(buildRecordListPath(collectionName, {
      filter,
      page: currentPage,
    }), {
      headers: {
        Accept: 'application/json',
        Authorization: token,
      },
      method: 'GET',
    });

    if (!upstream.response.ok) {
      throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
    }

    const normalizedResponse = normalizeListResponse(upstream.payload);

    if (!normalizedResponse) {
      throw new PocketBaseGatewayError(502, {
          message: `${collectionName} 列表响应缺少必要字段。`,
        });
    }

    normalizedResponse.items.forEach((item) => {
      recordIds.push(item.id);
    });
    totalPages = normalizedResponse.totalPages;
    currentPage += 1;
  } while (currentPage <= totalPages);

  return recordIds;
};

const deleteRecordById = async (
  token: string,
  collectionName: string,
  recordId: string,
): Promise<void> => {
  const upstream = await proxyPocketBaseRequest(`/api/collections/${collectionName}/records/${recordId}`, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'DELETE',
  });

  if (!upstream.response.ok && upstream.response.status !== 404) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }
};

const deleteRecordsByOwner = async (
  token: string,
  collectionName: string,
  ownerId: string,
  options: {
    filterField?: string;
    optional?: boolean;
  } = {},
): Promise<void> => {
  const filterField = options.filterField ?? 'owner';
  const filter = `${filterField} = ${escapeFilterValue(ownerId)}`;

  try {
    const recordIds = await listRecordIdsByFilter(token, collectionName, filter);

    for (const recordId of recordIds) {
      await deleteRecordById(token, collectionName, recordId);
    }
  } catch (error) {
    const upstreamError =
      error instanceof PocketBaseGatewayError
        ? error
        : null;

    if (
      options.optional === true &&
      upstreamError &&
      isOptionalCollectionMissing(upstreamError.status, upstreamError.payload)
    ) {
      return;
    }

    throw error;
  }
};

const handleLogin = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const body = await parseJsonBody(request);

  if (!isRecord(body)) {
    sendJson(response, 400, {
      message: '登录请求缺少有效参数。',
    });
    return;
  }

  const identity = toTrimmedString(body.identity);
  const password = toTrimmedString(body.password);

  if (!identity || !password) {
    sendJson(response, 400, {
      message: '邮箱和密码不能为空。',
    });
    return;
  }

  const upstream = await proxyPocketBaseRequest(
    `/api/collections/${authCollection}/auth-with-password`,
    {
      body: JSON.stringify({
        identity,
        password,
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  if (!upstream.response.ok) {
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return;
  }

  const authResponse = normalizeAuthResponse(upstream.payload);

  if (!authResponse) {
    sendJson(response, 502, {
      message: 'PocketBase 登录响应缺少必要字段。',
    });
    return;
  }

  if (authResponse.record.verified !== true) {
    sendUnverifiedResponse(response, request, authResponse.record.email);
    return;
  }

  setAuthCookie(response, request, authResponse.token);
  sendClientSession(response, 200, authResponse.record);
};

const handleRegister = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const body = await parseJsonBody(request);

  if (!isRecord(body)) {
    sendJson(response, 400, {
      message: '注册请求缺少有效参数。',
    });
    return;
  }

  const email = toTrimmedString(body.email);
  const password = toTrimmedString(body.password);
  const passwordConfirm = toTrimmedString(body.passwordConfirm);

  if (!email || !password || !passwordConfirm) {
    sendJson(response, 400, {
      message: '注册信息不能为空。',
    });
    return;
  }

  const createResponse = await proxyPocketBaseRequest(`/api/collections/${authCollection}/records`, {
    body: JSON.stringify({
      email,
      name: email,
      password,
      passwordConfirm,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!createResponse.response.ok) {
    sendUpstreamError(response, createResponse.response.status, createResponse.payload);
    return;
  }

  const verificationResponse = await requestEmailAction('request-verification', email);

  if (!verificationResponse.response.ok) {
    sendJson(response, 201, {
      email,
      message: '账号已创建，但验证邮件发送失败，请稍后在登录页重新发送验证邮件。',
      verificationEmailSent: false,
      verificationRequired: true,
    });
    return;
  }

  clearAuthCookie(response, request);
  sendJson(response, 201, {
    email,
    message: '注册成功，验证邮件已发送，请先完成邮箱验证后再登录。',
    verificationEmailSent: true,
    verificationRequired: true,
  });
};

const handleSession = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const token = getAuthCookieValue(request);

  if (!token) {
    clearAuthCookie(response, request);
    sendJson(response, 401, {
      message: '未找到登录态，请重新登录。',
    });
    return;
  }

  const upstream = await proxyPocketBaseRequest(`/api/collections/${authCollection}/auth-refresh`, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'POST',
  });

  if (!upstream.response.ok) {
    clearAuthCookie(response, request);
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return;
  }

  const authResponse = normalizeAuthResponse(upstream.payload);

  if (!authResponse) {
    clearAuthCookie(response, request);
    sendJson(response, 502, {
      message: 'PocketBase 会话刷新响应缺少必要字段。',
    });
    return;
  }

  if (authResponse.record.verified !== true) {
    sendUnverifiedResponse(response, request, authResponse.record.email);
    return;
  }

  setAuthCookie(response, request, authResponse.token);
  sendClientSession(response, 200, authResponse.record);
};

const handleUpdateProfile = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const token = getAuthCookieValue(request);

  if (!token) {
    clearAuthCookie(response, request);
    sendJson(response, 401, {
      message: '未找到登录态，请重新登录。',
    });
    return;
  }

  const body = await parseJsonBody(request);

  if (!isRecord(body) || typeof body.name !== 'string') {
    sendJson(response, 400, {
      message: '昵称更新请求缺少有效参数。',
    });
    return;
  }

  const name = toTrimmedString(body.name);

  if (name.length > 40) {
    sendJson(response, 400, {
      message: '昵称不能超过 40 个字符。',
    });
    return;
  }

  const sessionUpstream = await proxyPocketBaseRequest(`/api/collections/${authCollection}/auth-refresh`, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'POST',
  });

  if (!sessionUpstream.response.ok) {
    clearAuthCookie(response, request);
    sendUpstreamError(response, sessionUpstream.response.status, sessionUpstream.payload);
    return;
  }

  const authResponse = normalizeAuthResponse(sessionUpstream.payload);

  if (!authResponse) {
    clearAuthCookie(response, request);
    sendJson(response, 502, {
      message: 'PocketBase 会话刷新响应缺少必要字段。',
    });
    return;
  }

  if (authResponse.record.verified !== true) {
    sendUnverifiedResponse(response, request, authResponse.record.email);
    return;
  }

  const updateUpstream = await proxyPocketBaseRequest(
    `/api/collections/${authCollection}/records/${authResponse.record.id}`,
    {
      body: JSON.stringify({
        name,
      }),
      headers: {
        Accept: 'application/json',
        Authorization: authResponse.token,
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    },
  );

  if (!updateUpstream.response.ok) {
    sendUpstreamError(response, updateUpstream.response.status, updateUpstream.payload);
    return;
  }

  const updatedRecord = isRecord(updateUpstream.payload)
    ? normalizeUser(updateUpstream.payload)
    : null;

  if (!updatedRecord) {
    sendJson(response, 502, {
      message: 'PocketBase 昵称更新响应缺少必要字段。',
    });
    return;
  }

  setAuthCookie(response, request, authResponse.token);
  sendClientSession(response, 200, updatedRecord);
};

const handleRequestVerification = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const body = await parseJsonBody(request);

  if (!isRecord(body)) {
    sendJson(response, 400, {
      message: '重发验证邮件请求缺少有效参数。',
    });
    return;
  }

  const email = toTrimmedString(body.email);

  if (!email) {
    sendJson(response, 400, {
      message: '邮箱不能为空。',
    });
    return;
  }

  const upstream = await requestEmailAction('request-verification', email);

  if (!upstream.response.ok && upstream.response.status >= 500) {
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return;
  }

  sendJson(
    response,
    200,
    toGenericEmailActionResult('如果该邮箱已注册，验证邮件已发送，请注意查收。'),
  );
};

const handleRequestPasswordReset = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const body = await parseJsonBody(request);

  if (!isRecord(body)) {
    sendJson(response, 400, {
      message: '找回密码请求缺少有效参数。',
    });
    return;
  }

  const email = toTrimmedString(body.email);

  if (!email) {
    sendJson(response, 400, {
      message: '邮箱不能为空。',
    });
    return;
  }

  const upstream = await requestEmailAction('request-password-reset', email);

  if (!upstream.response.ok && upstream.response.status >= 500) {
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return;
  }

  sendJson(
    response,
    200,
    toGenericEmailActionResult('如果该邮箱已注册，重置密码邮件已发送，请注意查收。'),
  );
};

const handleLogout = (request: IncomingMessage, response: ServerResponse): void => {
  clearAuthCookie(response, request);
  sendJson(response, 200, {
    success: true,
  });
};

const refreshAuthenticatedSession = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<PocketBaseSessionResponse | null> => {
  const token = getAuthCookieValue(request);

  if (!token) {
    clearAuthCookie(response, request);
    sendApiError(response, 401, '未找到登录态，请重新登录。');
    return null;
  }

  const upstream = await proxyPocketBaseRequest(`/api/collections/${authCollection}/auth-refresh`, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'POST',
  });

  if (!upstream.response.ok) {
    clearAuthCookie(response, request);
    sendApiError(response, upstream.response.status, normalizeErrorPayload(upstream.payload).message ?? '登录态已失效。');
    return null;
  }

  const authResponse = normalizeAuthResponse(upstream.payload);

  if (!authResponse) {
    clearAuthCookie(response, request);
    sendApiError(response, 502, 'PocketBase 会话刷新响应缺少必要字段。');
    return null;
  }

  if (authResponse.record.verified !== true) {
    sendUnverifiedResponse(response, request, authResponse.record.email);
    return null;
  }

  setAuthCookie(response, request, authResponse.token);

  return authResponse;
};

const logAiRecognitionFailure = async (
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

const readBeanImageRecognitionUsageState = async (
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

const handleBeanImageRecognitionUsage = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const authResponse = await refreshAuthenticatedSession(request, response);

  if (!authResponse) {
    return;
  }

  let superuserToken = '';

  try {
    superuserToken = await getRequiredSuperuserToken();
  } catch (error) {
    const statusCode = error instanceof PocketBaseGatewayError ? error.status : 500;
    const message =
      error instanceof PocketBaseGatewayError
        ? normalizeErrorPayload(error.payload).message ?? error.message
        : 'PocketBase 管理员登录失败，无法使用 AI 识别。';

    sendApiError(response, statusCode, message);
    return;
  }

  const month = formatShanghaiMonth(new Date());
  const ownerId = authResponse.record.id;
  let usageState: AiUsageState;

  try {
    usageState = await readBeanImageRecognitionUsageState(superuserToken, ownerId, month);
  } catch (error) {
    const statusCode = error instanceof PocketBaseGatewayError ? error.status : 500;
    const message =
      error instanceof PocketBaseGatewayError
        ? normalizeErrorPayload(error.payload).message ?? error.message
        : 'AI 使用额度读取失败。';

    sendApiError(response, statusCode, message);
    return;
  }

  if (request.method === 'GET') {
    sendApiSuccess(response, usageState);
    return;
  }

  if (!usageState.enabled) {
    sendApiError(response, 403, '当前账号的 AI 图片识别功能已关闭。', {
      monthlyLimit: usageState.monthlyLimit,
      remainingUses: 0,
      usedThisMonth: usageState.usedThisMonth,
    });
    return;
  }

  if (usageState.remainingUses <= 0) {
    sendApiError(response, 429, '本月 AI 图片识别次数已用完。', {
      monthlyLimit: usageState.monthlyLimit,
      remainingUses: 0,
      usedThisMonth: usageState.usedThisMonth,
    });
    return;
  }

  let imageDataUrl = '';

  try {
    imageDataUrl = (await parseImageRecognitionRequest(request)).imageDataUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 图片识别请求参数无效。';

    await logAiRecognitionFailure(superuserToken, {
      errorMessage: message,
      month,
      ownerId,
    });
    sendApiError(response, 400, message);
    return;
  }

  try {
    const recognition = await requestQiniuBeanImageRecognition(imageDataUrl);

    await createAiUsageLog(superuserToken, {
      feature: AI_FEATURE_BEAN_IMAGE_RECOGNITION,
      month,
      ownerId,
      status: 'success',
    });

    const nextUsedThisMonth = usageState.usedThisMonth + 1;

    sendApiSuccess(response, {
      monthlyLimit: usageState.monthlyLimit,
      recognition,
      remainingUses: Math.max(usageState.monthlyLimit - nextUsedThisMonth, 0),
      usedThisMonth: nextUsedThisMonth,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 图片识别失败。';

    await logAiRecognitionFailure(superuserToken, {
      errorMessage: message,
      month,
      ownerId,
    });
    sendApiError(response, 502, message);
  }
};

const handleDeleteAccount = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const token = getAuthCookieValue(request);

  if (!token) {
    clearAuthCookie(response, request);
    sendJson(response, 401, {
      message: '未找到登录态，请重新登录。',
    });
    return;
  }

  const sessionUpstream = await proxyPocketBaseRequest(`/api/collections/${authCollection}/auth-refresh`, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'POST',
  });

  if (!sessionUpstream.response.ok) {
    clearAuthCookie(response, request);
    sendUpstreamError(response, sessionUpstream.response.status, sessionUpstream.payload);
    return;
  }

  const authResponse = normalizeAuthResponse(sessionUpstream.payload);

  if (!authResponse) {
    clearAuthCookie(response, request);
    sendJson(response, 502, {
      message: 'PocketBase 会话刷新响应缺少必要字段。',
    });
    return;
  }

  if (authResponse.record.verified !== true) {
    sendUnverifiedResponse(response, request, authResponse.record.email);
    return;
  }

  const deletionTargets: { filterField?: string; name: string; optional?: boolean }[] = [
    { name: 'finance_expense_records' },
    { name: 'finance_income_records', optional: true },
    { name: 'cost_calculations' },
    { name: 'coffee_beans', optional: true },
    { name: 'bean_sale_specs', optional: true },
    { name: 'roast_batches', optional: true },
    { name: 'roast_profiles' },
    { name: 'roast_records' },
    { name: 'green_bean_purchase_batches' },
    { name: 'green_beans' },
    { name: 'app_settings', optional: true },
  ];

  try {
    for (const target of deletionTargets) {
      await deleteRecordsByOwner(authResponse.token, target.name, authResponse.record.id, {
        filterField: target.filterField,
        optional: target.optional,
      });
    }

    const optionalSuperuserToken = await getOptionalSuperuserToken();

    if (optionalSuperuserToken) {
      await deleteRecordsByOwner(optionalSuperuserToken, AI_USAGE_LOGS_COLLECTION, authResponse.record.id, {
        optional: true,
      });
      await deleteRecordsByOwner(optionalSuperuserToken, AI_USAGE_LIMITS_COLLECTION, authResponse.record.id, {
        optional: true,
      });
    }

    const deleteUserUpstream = await proxyPocketBaseRequest(
      `/api/collections/${authCollection}/records/${authResponse.record.id}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: authResponse.token,
        },
        method: 'DELETE',
      },
    );

    if (!deleteUserUpstream.response.ok && deleteUserUpstream.response.status !== 404) {
      sendUpstreamError(response, deleteUserUpstream.response.status, deleteUserUpstream.payload);
      return;
    }
  } catch (error) {
    const upstreamError =
      error instanceof PocketBaseGatewayError
        ? error
        : null;

    if (upstreamError) {
      sendUpstreamError(response, upstreamError.status, upstreamError.payload);
      return;
    }

    sendJson(response, 500, {
      message: '账号注销失败，请稍后重试。',
    });
    return;
  }

  clearAuthCookie(response, request);
  sendJson(response, 200, toAccountDeletionResult('账号已注销，所有关联数据已删除。'));
};

const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');

  if (requestUrl.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, {
      ok: true,
    });
    return;
  }

  if (requestUrl.pathname === '/api/ai/bean-image-recognition') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendMethodNotAllowed(response, ['GET', 'POST']);
      return;
    }

    await handleBeanImageRecognitionUsage(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/login') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    await handleLogin(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/register') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    await handleRegister(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/session') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }

    await handleSession(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/request-verification') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    await handleRequestVerification(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/request-password-reset') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    await handleRequestPasswordReset(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/profile') {
    if (request.method !== 'PATCH') {
      sendMethodNotAllowed(response, ['PATCH']);
      return;
    }

    await handleUpdateProfile(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/logout') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    handleLogout(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/account') {
    if (request.method !== 'DELETE') {
      sendMethodNotAllowed(response, ['DELETE']);
      return;
    }

    await handleDeleteAccount(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/realtime') {
    await handleRealtimeRequest(request, response);
    return;
  }

  if (await handleBusinessCollectionRequest(request, response, requestUrl)) {
    return;
  }

  sendJson(response, 404, {
    message: 'Not Found',
  });
};

export const handleAuthGatewayRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  await handleRequest(request, response).catch((error: unknown) => {
    if (response.headersSent) {
      response.destroy(error instanceof Error ? error : undefined);
      return;
    }

    const message = error instanceof Error && error.message.trim().length > 0 ? error.message : '登录网关服务异常。';

    sendJson(response, 500, {
      message,
    });
  });
};

const isDirectExecution = (): boolean => {
  const entryPath = process.argv[1];

  return Boolean(entryPath && import.meta.url === pathToFileURL(entryPath).href);
};

const startStandaloneServer = (): void => {
  const server = createServer((request, response) => {
    void handleAuthGatewayRequest(request, response);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    const message =
      error.code === 'EADDRINUSE'
        ? `PocketBase auth BFF 启动失败：127.0.0.1:${String(port)} 已被占用。`
        : `PocketBase auth BFF 启动失败：${error.message}`;

    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });

  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`PocketBase auth BFF is listening on http://127.0.0.1:${String(port)}\n`);
  });
};

if (isDirectExecution()) {
  startStandaloneServer();
}
