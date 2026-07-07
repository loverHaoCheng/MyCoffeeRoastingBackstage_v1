import { AppError } from '@/shared/errors/AppError';

import { normalizeSupabaseProjectUrl } from './pocketBaseConfig';

type Fetcher = typeof fetch;

interface SupabaseDataClientOptions {
  fetcher?: Fetcher;
  projectUrl: string;
  publishableKey: string;
  timeoutMs?: number;
}

interface SupabaseDataListOptions {
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
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;

const shouldAttachAbortSignal = (): boolean => {
  return typeof window !== 'undefined';
};

const parseSupabaseErrorPayload = (payload: unknown): SupabaseErrorPayload => {
  if (typeof payload !== 'object' || payload == null) {
    return {};
  }

  const record = payload as Record<string, unknown>;

  return {
    code: typeof record.code === 'string' ? record.code : undefined,
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
    return new AppError('Supabase 表或记录不存在，请先执行熟豆库初始化脚本。', {
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

  if (payload == null) {
    return [];
  }

  return [payload as T];
};

export class SupabaseDataClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly publishableKey: string;
  private readonly timeoutMs: number;

  constructor(options: SupabaseDataClientOptions) {
    const raw = options.fetcher ?? fetch;

    this.baseUrl = normalizeSupabaseProjectUrl(options.projectUrl);
    this.fetcher = (...args: Parameters<Fetcher>) => raw(...args);
    this.publishableKey = options.publishableKey.trim();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async verify(tableName = 'coffee_beans'): Promise<void> {
    await this.list(tableName, {
      limit: 1,
      select: 'id',
    });
  }

  async list<T>(tableName: string, options: SupabaseDataListOptions = {}): Promise<T[]> {
    if (!this.isConfigured()) {
      throw new AppError('Supabase 连接配置缺失。', {
        code: 'CONFIG',
      });
    }

    const url = this.buildTableUrl(tableName);

    url.searchParams.set('select', options.select?.trim() ?? '*');

    if (options.limit != null) {
      url.searchParams.set('limit', String(options.limit));
    }

    if (options.orderBy) {
      url.searchParams.set(
        'order',
        `${options.orderBy.column}.${options.orderBy.ascending === false ? 'desc' : 'asc'}`,
      );
    }

    Object.entries(options.match ?? {}).forEach(([column, value]) => {
      url.searchParams.set(column, `eq.${String(value)}`);
    });

    return this.request<T[]>(url, {
      method: 'GET',
    });
  }

  async insert<TOutput>(
    tableName: string,
    payload: Record<string, unknown>,
  ): Promise<TOutput[]> {
    if (!this.isConfigured()) {
      throw new AppError('Supabase 连接配置缺失。', {
        code: 'CONFIG',
      });
    }

    return this.request<TOutput[]>(this.buildTableUrl(tableName), {
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      method: 'POST',
    });
  }

  private buildTableUrl(tableName: string): URL {
    return new URL(`/rest/v1/${tableName}`, this.baseUrl);
  }

  private getHeaders(headers?: HeadersInit): Headers {
    const mergedHeaders = new Headers(headers);

    mergedHeaders.set('Accept', 'application/json');
    mergedHeaders.set('apikey', this.publishableKey);
    mergedHeaders.set('Authorization', `Bearer ${this.publishableKey}`);

    return mergedHeaders;
  }

  private isConfigured(): boolean {
    return this.baseUrl.length > 0 && this.publishableKey.length > 0;
  }

  private async request<T>(url: URL, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const requestInit: RequestInit = {
        ...init,
        headers: this.getHeaders(init.headers),
      };

      if (shouldAttachAbortSignal()) {
        requestInit.signal = controller.signal;
      }

      const response = await this.fetcher(url.toString(), requestInit);
      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        throw toAppError(response, payload);
      }

      return toRecordArray<T extends (infer Item)[] ? Item : T>(payload) as T;
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

      throw new AppError('无法连接到 Supabase，请检查网络、地址或密钥。', {
        code: 'NETWORK',
        cause: error,
      });
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
}
