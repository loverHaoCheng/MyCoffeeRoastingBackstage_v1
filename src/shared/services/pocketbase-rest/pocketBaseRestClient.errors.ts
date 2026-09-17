import { AppError } from '@/shared/errors/AppError';

import type {
  PocketBaseErrorFieldIssue,
  PocketBaseErrorPayload,
} from './pocketBaseRestClient.types';

const parsePocketBaseErrorPayload = (payload: unknown): PocketBaseErrorPayload => {
  if (typeof payload !== 'object' || payload == null) {
    return {};
  }

  const record = payload as Record<string, unknown>;

  return {
    code: typeof record.code === 'string' || typeof record.code === 'number' ? record.code : undefined,
    data: record.data,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
};

const POCKETBASE_FIELD_LABELS: Record<string, string> = {
  batch_weight_grams: '批次重量',
  bean_name: '生豆名称',
  channel: '收入类别',
  firePower: '火力',
  green_bean_id: '生豆',
  green_bean_name: '生豆名称',
  income_date: '收入日期',
  is_active: '启用状态',
  amount: '金额',
  name: '名称',
  note: '备注',
  notes: '备注',
  operation: '操作',
  owner: '所属账号',
  planned_batch_kg: '计划批量',
  roast_plan_id: '烘焙计划',
  roast_plan_name: '烘焙计划名称',
  roast_purpose: '用途',
  roasted_bean_name: '熟豆名称',
  status: '状态',
  steps: '烘焙节点',
  target_roast_level: '烘焙目标',
  temperature: '炉温',
  time: '时间',
};

const parsePocketBaseFieldIssues = (
  payload: PocketBaseErrorPayload,
): { fieldName: string; issue: PocketBaseErrorFieldIssue }[] => {
  if (typeof payload.data !== 'object' || payload.data == null) {
    return [];
  }

  return Object.entries(payload.data as Record<string, unknown>).flatMap(([fieldName, value]) => {
    if (typeof value !== 'object' || value == null) {
      return [];
    }

    const issueRecord = value as Record<string, unknown>;

    return [{
      fieldName,
      issue: {
        code: typeof issueRecord.code === 'string' ? issueRecord.code : undefined,
        message: typeof issueRecord.message === 'string' ? issueRecord.message : undefined,
      },
    }];
  });
};

const normalizePocketBaseFieldIssueMessage = (
  fieldName: string,
  issue: PocketBaseErrorFieldIssue,
): string => {
  const label = POCKETBASE_FIELD_LABELS[fieldName] ?? fieldName;
  const message = issue.message?.trim() ?? '';
  const normalizedMessage = message.toLowerCase();
  const normalizedCode = issue.code?.trim().toLowerCase() ?? '';

  if (
    normalizedCode === 'validation_required' ||
    normalizedMessage.includes('missing required value') ||
    normalizedMessage.includes('required')
  ) {
    return `${label}不能为空`;
  }

  const minMatch = /greater or equal than\s+(-?\d+(?:\.\d+)?)/i.exec(normalizedMessage);

  if (minMatch?.[1]) {
    return `${label}不能小于 ${minMatch[1]}`;
  }

  const maxMatch = /less or equal than\s+(-?\d+(?:\.\d+)?)/i.exec(normalizedMessage);

  if (maxMatch?.[1]) {
    return `${label}不能大于 ${maxMatch[1]}`;
  }

  if (normalizedMessage.includes('invalid') || normalizedCode === 'validation_invalid_value') {
    return `${label}格式无效`;
  }

  if (normalizedMessage.includes('already exists') || normalizedMessage.includes('must be unique')) {
    return `${label}已存在，请更换后重试`;
  }

  if (normalizedMessage.length === 0) {
    return `${label}校验失败`;
  }

  return `${label}校验失败：${message}`;
};

const isGenericPocketBaseFailureMessage = (message: string): boolean => {
  return /something went wrong while processing your request/i.test(message);
};

const normalizePocketBaseErrorMessage = (status: number, message: string): string => {
  if (isGenericPocketBaseFailureMessage(message)) {
    return `PocketBase 请求失败，请稍后重试或联系管理员检查服务日志。（HTTP ${String(status)}）`;
  }

  return message;
};

const buildPocketBaseValidationMessage = (
  status: number,
  payload: PocketBaseErrorPayload,
): string | null => {
  if (status !== 400) {
    return null;
  }

  const fieldIssues = parsePocketBaseFieldIssues(payload).map(({ fieldName, issue }) =>
    normalizePocketBaseFieldIssueMessage(fieldName, issue),
  );

  if (fieldIssues.length > 0) {
    return `提交失败：${fieldIssues.join('；')}`;
  }

  const rawMessage = payload.message?.trim() ?? '';

  if (/failed to (create|update) record/i.test(rawMessage)) {
    return '提交失败，PocketBase 未通过数据校验，请检查必填项、字段格式和关联数据。';
  }

  return rawMessage.length > 0 ? normalizePocketBaseErrorMessage(status, rawMessage) : null;
};

export const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch (error) {
    throw new AppError('PocketBase 返回了无法解析的数据。', {
      code: 'DATA',
      status: response.status,
      cause: error,
    });
  }
};

export const toAppError = (response: Response, payload: unknown): AppError => {
  const pocketBaseError = parsePocketBaseErrorPayload(payload);
  const message =
    buildPocketBaseValidationMessage(response.status, pocketBaseError) ??
    (pocketBaseError.message ? normalizePocketBaseErrorMessage(response.status, pocketBaseError.message) : undefined) ??
    `PocketBase 请求失败：${String(response.status)}`;

  if (response.status === 401 || response.status === 403) {
    return new AppError(message, {
      code: 'AUTH',
      status: response.status,
      cause: payload,
    });
  }

  if (response.status === 404) {
    return new AppError('PocketBase 记录或集合不存在，请先执行初始化。', {
      code: 'HTTP',
      status: response.status,
      cause: payload,
    });
  }

  if (response.status === 429) {
    return new AppError(message, {
      code: 'RATE_LIMIT',
      status: response.status,
      cause: payload,
    });
  }

  if (response.status >= 500) {
    return new AppError('PocketBase 服务暂时不可用，请稍后重试。', {
      code: 'HTTP',
      status: response.status,
      cause: payload,
    });
  }

  return new AppError(message, {
    code: 'HTTP',
    status: response.status,
    cause: payload,
  });
};
