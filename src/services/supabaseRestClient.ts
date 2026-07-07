import { resolvePocketBaseBaseUrl, normalizePocketBaseBaseUrl } from '@/services/pocketBaseConfig';
import { pocketBaseSessionService } from '@/services/pocketBaseSession.service';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';

type Fetcher = typeof fetch;

interface PocketBaseRestClientOptions {
  fetcher?: Fetcher;
  projectUrl: string;
  publishableKey?: string;
  timeoutMs?: number;
}

interface PocketBaseRestListOptions {
  limit?: number;
  match?: Record<string, boolean | number | string>;
  orderBy?: {
    ascending?: boolean;
    column: string;
  };
  select?: string;
}

interface PocketBaseErrorPayload {
  code?: number | string;
  data?: unknown;
  message?: string;
}

interface PocketBaseErrorFieldIssue {
  code?: string;
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_PAGE_SIZE = 200;
const COLLECTION_ALIASES: Record<string, string> = {
  roast_batch_overview: 'roast_batches',
  roast_plan_overview: 'roast_profiles',
};

const shouldAttachAbortSignal = (): boolean => {
  return typeof window !== 'undefined';
};

const isConfigured = (baseUrl: string): boolean => {
  return normalizePocketBaseBaseUrl(baseUrl).length > 0;
};

const buildCollectionUrl = (baseUrl: string, collectionName: string, path = ''): string => {
  const resolvedCollectionName = COLLECTION_ALIASES[collectionName] ?? collectionName;

  return new URL(`/api/collections/${resolvedCollectionName}/records${path}`, normalizePocketBaseBaseUrl(baseUrl)).toString();
};

const escapeFilterValue = (value: string): string => {
  return `'${value.replaceAll("'", "\\'")}'`;
};

const buildFilterExpression = (
  match?: Record<string, boolean | number | string>,
  ownerId?: string,
): string | undefined => {
  const expressions: string[] = [];

  if (ownerId) {
    expressions.push(`owner = ${escapeFilterValue(ownerId)}`);
  }

  if (match) {
    Object.entries(match).forEach(([column, value]) => {
      if (typeof value === 'string') {
        expressions.push(`${column} = ${escapeFilterValue(value)}`);
        return;
      }

      if (typeof value === 'boolean' || typeof value === 'number') {
        expressions.push(`${column} = ${String(value)}`);
      }
    });
  }

  if (expressions.length === 0) {
    return undefined;
  }

  return expressions.map((expression) => `(${expression})`).join(' && ');
};

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
  firePower: '火力',
  green_bean_id: '生豆',
  green_bean_name: '生豆名称',
  is_active: '启用状态',
  name: '名称',
  note: '备注',
  operation: '操作',
  owner: '所属账号',
  planned_batch_kg: '计划批量',
  roast_plan_name: '烘焙计划名称',
  roast_purpose: '用途',
  roast_plan_id: '烘焙计划',
  roasted_bean_name: '熟豆名称',
  status: '状态',
  steps: '烘焙节点',
  target_roast_level: '烘焙目标',
  temperature: '炉温',
  time: '时间',
};

const parsePocketBaseFieldIssues = (payload: PocketBaseErrorPayload): Array<{ fieldName: string; issue: PocketBaseErrorFieldIssue }> => {
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

  const minMatch = normalizedMessage.match(/greater or equal than\s+(-?\d+(?:\.\d+)?)/i);

  if (minMatch?.[1]) {
    return `${label}不能小于 ${minMatch[1]}`;
  }

  const maxMatch = normalizedMessage.match(/less or equal than\s+(-?\d+(?:\.\d+)?)/i);

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

  return rawMessage.length > 0 ? rawMessage : null;
};

const parseJsonResponse = async (response: Response): Promise<unknown> => {
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

const toAppError = (response: Response, payload: unknown): AppError => {
  const pocketBaseError = parsePocketBaseErrorPayload(payload);
  const message =
    buildPocketBaseValidationMessage(response.status, pocketBaseError) ??
    pocketBaseError.message ??
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

const toRecordArray = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (typeof payload === 'object' && payload != null) {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.items)) {
      return record.items as T[];
    }

    return [payload as T];
  }

  return [];
};

const resolveOwnerId = (): string | undefined => {
  return pocketBaseSessionService.getUser()?.id;
};

const getRequestHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const token = pocketBaseSessionService.getToken();

  if (token) {
    headers.Authorization = token;
  }

  return headers;
};

const mergeHeaders = (...headerSets: (HeadersInit | undefined)[]): Headers => {
  const headers = new Headers();

  headerSets.forEach((headerSet) => {
    if (!headerSet) {
      return;
    }

    new Headers(headerSet).forEach((value, key) => {
      headers.set(key, value);
    });
  });

  return headers;
};

const toRecordId = (record: Record<string, unknown>): string => {
  const { id } = record;

  return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
};

const withTimestampFields = (payload: Record<string, unknown>, mode: 'insert' | 'update'): Record<string, unknown> => {
  const now = new Date().toISOString();

  if (mode === 'insert') {
    return {
      created_at: payload.created_at ?? now,
      ...payload,
      updated_at: payload.updated_at ?? now,
    };
  }

  return {
    ...payload,
    updated_at: now,
  };
};

export class PocketBaseRestClient {
  private readonly fetcher: Fetcher;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: PocketBaseRestClientOptions) {
    const raw = options.fetcher ?? fetch;
    this.fetcher = (...args: Parameters<Fetcher>) => raw(...args);
    this.baseUrl = normalizePocketBaseBaseUrl(options.projectUrl || resolvePocketBaseBaseUrl());
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async list<T>(collectionName: string, options: PocketBaseRestListOptions = {}): Promise<T[]> {
    if (!isConfigured(this.baseUrl)) {
      throw new AppError('PocketBase 连接配置缺失。', {
        code: 'CONFIG',
      });
    }

    const ownerId = collectionName === 'users' ? undefined : resolveOwnerId();
    const filter = buildFilterExpression(options.match, ownerId);
    const requestedLimit = options.limit ?? DEFAULT_PAGE_SIZE;
    const perPage = Math.min(requestedLimit, DEFAULT_PAGE_SIZE);
    const collected: T[] = [];
    let page = 1;

    for (;;) {
      const url = new URL(buildCollectionUrl(this.baseUrl, collectionName), this.baseUrl);
      url.searchParams.set('page', String(page));
      url.searchParams.set('perPage', String(perPage));

      if (options.orderBy) {
        url.searchParams.set(
          'sort',
          `${options.orderBy.ascending === false ? '-' : ''}${options.orderBy.column}`,
        );
      }

      if (options.select && options.select.trim().length > 0 && options.select.trim() !== '*') {
        url.searchParams.set('fields', options.select);
      }

      if (filter) {
        url.searchParams.set('filter', filter);
      }

      const controller = new AbortController();
      const timeoutId = globalThis.setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);

      try {
        const requestInit: RequestInit = {
          headers: getRequestHeaders(),
          method: 'GET',
        };

        if (shouldAttachAbortSignal()) {
          requestInit.signal = controller.signal;
        }

        const response = await this.fetcher(url.toString(), requestInit);

        logger.debug('pocketbase response received', {
          collectionName,
          page,
          status: response.status,
          statusText: response.statusText,
        });

        const payload = await parseJsonResponse(response);

        if (!response.ok) {
          logger.warn('pocketbase request failed', {
            collectionName,
            page,
            payload,
            status: response.status,
          });
          throw toAppError(response, payload);
        }

        const items = toRecordArray<T>(payload);
        collected.push(...items);

        if (requestedLimit <= 0 || collected.length >= requestedLimit) {
          return collected.slice(0, requestedLimit);
        }

        if (items.length < perPage) {
          return collected;
        }

        page += 1;
      } catch (error) {
        if (error instanceof AppError) {
          logger.error('pocketbase request app error', {
            cause: error.cause,
            message: error.message,
            collectionName,
          });
          throw error;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new AppError('PocketBase 请求超时。', {
            code: 'TIMEOUT',
            cause: error,
          });
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new AppError('当前网络不可用。', {
            code: 'NETWORK',
            cause: error,
          });
        }

        throw new AppError('无法连接到 PocketBase，请检查网络、地址或服务状态。', {
          code: 'NETWORK',
          cause: error,
        });
      } finally {
        globalThis.clearTimeout(timeoutId);
      }
    }
  }

  async insert<TOutput>(
    collectionName: string,
    payload: Record<string, unknown>,
    options: Pick<PocketBaseRestListOptions, 'select'> = {},
  ): Promise<TOutput[]> {
    if (!isConfigured(this.baseUrl)) {
      throw new AppError('PocketBase 连接配置缺失。', {
        code: 'CONFIG',
      });
    }

    void options;

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const requestInit: RequestInit = {
        body: JSON.stringify(withTimestampFields(this.withOwner(payload), 'insert')),
        headers: mergeHeaders(getRequestHeaders(), {
          'Content-Type': 'application/json',
        }),
        method: 'POST',
      };

      if (shouldAttachAbortSignal()) {
        requestInit.signal = controller.signal;
      }

      const response = await this.fetcher(buildCollectionUrl(this.baseUrl, collectionName), requestInit);
      const payloadResult = await parseJsonResponse(response);

      if (!response.ok) {
        throw toAppError(response, payloadResult);
      }

      return toRecordArray<TOutput>(payloadResult);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AppError('PocketBase 请求超时。', {
          code: 'TIMEOUT',
          cause: error,
        });
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new AppError('当前网络不可用。', {
          code: 'NETWORK',
          cause: error,
        });
      }

      throw new AppError('无法连接到 PocketBase，请检查网络、地址或服务状态。', {
        code: 'NETWORK',
        cause: error,
      });
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }

  async update<TOutput>(
    collectionName: string,
    payload: Record<string, unknown>,
    options: Pick<PocketBaseRestListOptions, 'match' | 'select'>,
  ): Promise<TOutput[]> {
    return this.mutate<TOutput>(
      collectionName,
      {
        body: JSON.stringify(withTimestampFields(this.withOwner(payload), 'update')),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      },
      options,
    );
  }

  async delete(collectionName: string, options: Pick<PocketBaseRestListOptions, 'match'>): Promise<void> {
    const records = await this.list<Record<string, unknown>>(collectionName, {
      match: options.match,
    });

    await Promise.all(
      records
        .map(toRecordId)
        .filter((id) => id.length > 0)
        .map(async (recordId) => {
          const response = await this.fetcher(buildCollectionUrl(this.baseUrl, collectionName, `/${recordId}`), {
            headers: getRequestHeaders(),
            method: 'DELETE',
          });

          if (!response.ok) {
            const payload = await parseJsonResponse(response);
            throw toAppError(response, payload);
          }
        }),
    );
  }

  private withOwner(payload: Record<string, unknown>): Record<string, unknown> {
    const ownerId = resolveOwnerId();

    if (!ownerId || 'owner' in payload) {
      return payload;
    }

    return {
      ...payload,
      owner: ownerId,
    };
  }

  private async mutate<T>(
    collectionName: string,
    init: RequestInit,
    options: Pick<PocketBaseRestListOptions, 'match' | 'select'>,
  ): Promise<T[]> {
    if (!isConfigured(this.baseUrl)) {
      throw new AppError('PocketBase 连接配置缺失。', {
        code: 'CONFIG',
      });
    }

    const matchedRecords =
      options.match?.id != null
        ? [{ id: String(options.match.id) }]
        : await this.list<Record<string, unknown>>(collectionName, {
            match: options.match,
            select: 'id',
          });

    if (matchedRecords.length === 0) {
      throw new AppError('PocketBase 未找到对应记录。', {
        code: 'DATA',
      });
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const requestInit: RequestInit = {
        ...init,
        headers: mergeHeaders(getRequestHeaders(), init.headers),
      };

      if (shouldAttachAbortSignal()) {
        requestInit.signal = controller.signal;
      }

      const updatedRecords: T[] = [];

      for (const record of matchedRecords) {
        const recordId = toRecordId(record);

        if (!recordId) {
          continue;
        }

        const response = await this.fetcher(buildCollectionUrl(this.baseUrl, collectionName, `/${recordId}`), requestInit);
        const payload = await parseJsonResponse(response);

        if (!response.ok) {
          throw toAppError(response, payload);
        }

        const items = toRecordArray<T>(payload);
        updatedRecords.push(...items);
      }

      return updatedRecords;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AppError('PocketBase 请求超时。', {
          code: 'TIMEOUT',
          cause: error,
        });
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new AppError('当前网络不可用。', {
          code: 'NETWORK',
          cause: error,
        });
      }

      throw new AppError('无法连接到 PocketBase，请检查网络、地址或服务状态。', {
        code: 'NETWORK',
        cause: error,
      });
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

export { PocketBaseRestClient as SupabaseRestClient };
