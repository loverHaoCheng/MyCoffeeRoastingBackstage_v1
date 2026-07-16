import { AppError } from '@/shared/errors/AppError';

import type { ApiResponse } from './api.types';

type Fetcher = typeof fetch;

interface HttpClientOptions {
  baseUrl?: string;
  fetcher?: Fetcher;
  getAuthToken?: () => string | undefined;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

const defaultBaseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

const defaultFetcher: Fetcher = (input, init) => globalThis.fetch(input, init);

const isFormData = (value: unknown): value is FormData => {
  return typeof FormData !== 'undefined' && value instanceof FormData;
};

const isApiResponse = <T,>(payload: unknown): payload is ApiResponse<T> => {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const candidate = payload as Partial<ApiResponse<T>>;
  return typeof candidate.code === 'number' && typeof candidate.message === 'string' && 'data' in candidate;
};

const getPayloadMessage = (payload: unknown): string => {
  if (typeof payload !== 'object' || payload === null) {
    return '';
  }

  const candidate = payload as { message?: unknown };

  return typeof candidate.message === 'string' ? candidate.message.trim() : '';
};

const buildUrl = (baseUrl: string, path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

export const resolveHttpClientUrl = (path: string, baseUrl = defaultBaseUrl): string => {
  return buildUrl(baseUrl, path);
};

export const resolveHttpClientAbsoluteUrl = (path: string, baseUrl = defaultBaseUrl): string => {
  const resolvedUrl = resolveHttpClientUrl(path, baseUrl);

  if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
    return resolvedUrl;
  }

  if (typeof window === 'undefined') {
    return resolvedUrl;
  }

  return new URL(resolvedUrl, window.location.origin).toString();
};

const serializeBody = (body: unknown): BodyInit | undefined => {
  if (body === undefined) {
    return undefined;
  }

  if (isFormData(body)) {
    return body;
  }

  if (typeof body === 'string') {
    return body;
  }

  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return body;
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return body;
  }

  return JSON.stringify(body);
};

const parseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new AppError('服务端返回了无法解析的数据。', {
      code: 'UNKNOWN',
      status: response.status,
      cause: error,
    });
  }
};

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly getAuthToken?: () => string | undefined;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? defaultBaseUrl;
    this.fetcher = options.fetcher ?? defaultFetcher;
    this.getAuthToken = options.getAuthToken;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const headers = new Headers(options.headers);
    const token = this.getAuthToken?.();
    const body = options.body;

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (body !== undefined && !isFormData(body) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const response = await this.fetcher(buildUrl(this.baseUrl, path), {
        credentials: 'same-origin',
        ...options,
        headers,
        body: serializeBody(body),
      });

      const payload = await parseJson(response);

      if (!response.ok) {
        const payloadMessage = getPayloadMessage(payload);

        throw new AppError(payloadMessage || `请求失败：${String(response.status)}`, {
          code: 'HTTP',
          status: response.status,
          cause: payload,
        });
      }

      if (!isApiResponse<T>(payload)) {
        throw new AppError('接口返回格式不符合约定。', {
          code: 'UNKNOWN',
          status: response.status,
          cause: payload,
        });
      }

      if (payload.code !== 0) {
        throw new AppError(payload.message, {
          code: 'BUSINESS',
          status: response.status,
          cause: payload,
        });
      }

      return payload;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('网络连接异常，请稍后重试。', {
        code: 'NETWORK',
        cause: error,
      });
    }
  }

  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  put<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const httpClient = new HttpClient();
