import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';

type Fetcher = typeof fetch;

interface SupabaseRestClientOptions {
  fetcher?: Fetcher;
  projectUrl: string;
  publishableKey: string;
  schema?: string;
  timeoutMs?: number;
}

interface SupabaseRestListOptions {
  limit?: number;
  match?: Record<string, boolean | number | string>;
  orderBy?: {
    ascending?: boolean;
    column: string;
  };
  select?: string;
}

interface SupabaseErrorPayload {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 10000;

const shouldAttachAbortSignal = (): boolean => {
  return typeof window !== 'undefined';
};

const isSupabaseConfigured = (projectUrl: string, publishableKey: string): boolean => {
  return projectUrl.trim().length > 0 && publishableKey.trim().length > 0;
};

const buildTableUrl = (projectUrl: string, tableName: string, options: SupabaseRestListOptions): string => {
  const url = new URL(`/rest/v1/${tableName}`, projectUrl);

  url.searchParams.set('select', options.select ?? '*');

  if (options.orderBy) {
    url.searchParams.set(
      'order',
      `${options.orderBy.column}.${options.orderBy.ascending === false ? 'desc' : 'asc'}`,
    );
  }

  if (options.limit != null) {
    url.searchParams.set('limit', String(options.limit));
  }

  if (options.match) {
    Object.entries(options.match).forEach(([column, value]) => {
      url.searchParams.set(column, `eq.${String(value)}`);
    });
  }

  return url.toString();
};

const parseSupabaseErrorPayload = (payload: unknown): SupabaseErrorPayload => {
  if (typeof payload !== 'object' || payload == null) {
    return {};
  }

  const record = payload as Record<string, unknown>;

  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    details: typeof record.details === 'string' || record.details === null ? record.details : undefined,
    hint: typeof record.hint === 'string' || record.hint === null ? record.hint : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
};

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch (error) {
    throw new AppError('Supabase 返回了无法解析的数据。', {
      code: 'DATA',
      status: response.status,
      cause: error,
    });
  }
};

const toAppError = (response: Response, payload: unknown): AppError => {
  const supabaseError = parseSupabaseErrorPayload(payload);
  const message = supabaseError.message ?? `Supabase 请求失败：${String(response.status)}`;

  if (response.status === 401 || response.status === 403) {
    return new AppError(message, {
      code: 'AUTH',
      status: response.status,
      cause: payload,
    });
  }

  if (response.status === 404) {
    return new AppError('Supabase 表或视图不存在，请先执行建表 SQL。', {
      code: 'HTTP',
      status: response.status,
      cause: payload,
    });
  }

  if (response.status === 406) {
    return new AppError('Supabase 返回的数据不符合当前查询预期。', {
      code: 'DATA',
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
    return new AppError('Supabase 服务暂时不可用，请稍后重试。', {
      code: 'HTTP',
      status: response.status,
      cause: payload,
    });
  }

  if (supabaseError.code?.startsWith('PGRST')) {
    return new AppError(message, {
      code: 'DATA',
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

export class SupabaseRestClient {
  private readonly fetcher: Fetcher;
  private readonly projectUrl: string;
  private readonly publishableKey: string;
  private readonly schema: string;
  private readonly timeoutMs: number;

  constructor(options: SupabaseRestClientOptions) {
    const raw = options.fetcher ?? fetch;
    // 用箭头函数包装 fetch，避免 "Illegal invocation"
    this.fetcher = (...args: Parameters<Fetcher>) => raw(...args);
    this.projectUrl = options.projectUrl.trim();
    this.publishableKey = options.publishableKey.trim();
    this.schema = options.schema ?? 'public';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async list<T>(tableName: string, options: SupabaseRestListOptions = {}): Promise<T[]> {
    if (!isSupabaseConfigured(this.projectUrl, this.publishableKey)) {
      throw new AppError('Supabase 连接配置缺失。', {
        code: 'CONFIG',
      });
    }

    const url = buildTableUrl(this.projectUrl, tableName, options);

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const requestInit: RequestInit = {
        headers: {
          Accept: 'application/json',
          apikey: this.publishableKey,
          Authorization: `Bearer ${this.publishableKey}`,
          'Accept-Profile': this.schema,
        },
        method: 'GET',
      };

      if (shouldAttachAbortSignal()) {
        requestInit.signal = controller.signal;
      }

      const response = await this.fetcher(url, requestInit);

      logger.debug('supabase response received', {
        status: response.status,
        statusText: response.statusText,
        tableName,
      });

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        logger.warn('supabase request failed', {
          payload,
          status: response.status,
          tableName,
        });
        throw toAppError(response, payload);
      }

      if (!Array.isArray(payload)) {
        throw new AppError('Supabase 列表查询返回的数据不是数组。', {
          code: 'DATA',
          status: response.status,
          cause: payload,
        });
      }

      logger.debug('supabase list loaded', {
        recordCount: payload.length,
        tableName,
      });
      return payload as T[];
    } catch (error) {
      if (error instanceof AppError) {
        logger.error('supabase request app error', {
          cause: error.cause,
          message: error.message,
          tableName,
        });
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        logger.error('supabase request timeout', {
          tableName,
        });
        throw new AppError('Supabase 请求超时。', {
          code: 'TIMEOUT',
          cause: error,
        });
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        logger.error('supabase network unavailable', {
          tableName,
        });
        throw new AppError('当前网络不可用。', {
          code: 'NETWORK',
          cause: error,
        });
      }

      logger.error('supabase network error', {
        error,
        tableName,
      });
      throw new AppError('无法连接到 Supabase，请检查网络、域名或访问策略。', {
        code: 'NETWORK',
        cause: error,
      });
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }

  async insert<TOutput>(
    tableName: string,
    payload: Record<string, unknown>,
    options: Pick<SupabaseRestListOptions, 'select'> = {},
  ): Promise<TOutput[]> {
    return this.mutate<TOutput>(tableName, {
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      method: 'POST',
    }, options);
  }

  async update<TOutput>(
    tableName: string,
    payload: Record<string, unknown>,
    options: Pick<SupabaseRestListOptions, 'match' | 'select'>,
  ): Promise<TOutput[]> {
    return this.mutate<TOutput>(tableName, {
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      method: 'PATCH',
    }, options);
  }

  async delete(
    tableName: string,
    options: Pick<SupabaseRestListOptions, 'match'>,
  ): Promise<void> {
    await this.mutate<null>(tableName, {
      headers: {
        Prefer: 'return=minimal',
      },
      method: 'DELETE',
    }, options);
  }

  private async mutate<T>(
    tableName: string,
    init: RequestInit,
    options: Pick<SupabaseRestListOptions, 'match' | 'select'>,
  ): Promise<T[]> {
    if (!isSupabaseConfigured(this.projectUrl, this.publishableKey)) {
      throw new AppError('Supabase 连接配置缺失。', {
        code: 'CONFIG',
      });
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const initHeaders = new Headers(init.headers);
      const requestInit: RequestInit = {
        ...init,
        headers: {
          Accept: 'application/json',
          apikey: this.publishableKey,
          Authorization: `Bearer ${this.publishableKey}`,
          'Accept-Profile': this.schema,
          ...Object.fromEntries(initHeaders.entries()),
        },
      };

      if (shouldAttachAbortSignal()) {
        requestInit.signal = controller.signal;
      }

      const response = await this.fetcher(buildTableUrl(this.projectUrl, tableName, options), requestInit);

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        throw toAppError(response, payload);
      }

      if (payload == null) {
        return [];
      }

      if (!Array.isArray(payload)) {
        throw new AppError('Supabase 变更请求返回的数据不是数组。', {
          code: 'DATA',
          status: response.status,
          cause: payload,
        });
      }

      return payload as T[];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AppError('Supabase 请求超时。', {
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

      throw new AppError('无法连接到 Supabase，请检查网络、域名或访问策略。', {
        code: 'NETWORK',
        cause: error,
      });
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
}
