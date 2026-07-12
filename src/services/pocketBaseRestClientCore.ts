import { resolvePocketBaseBaseUrl, normalizePocketBaseBaseUrl } from '@/services/pocketBaseConfig';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';
import { parseJsonResponse, toAppError } from '@/services/pocketbase-rest/pocketBaseRestClient.errors';
import type {
  Fetcher,
  PocketBaseRestClientOptions,
  PocketBaseRestListOptions,
} from '@/services/pocketbase-rest/pocketBaseRestClient.types';
import {
  buildCollectionUrl,
  buildFilterExpression,
  DEFAULT_PAGE_SIZE,
  DEFAULT_TIMEOUT_MS,
  getRequestHeaders,
  isConfigured,
  mergeHeaders,
  resolveOwnerId,
  shouldAttachAbortSignal,
  toRecordArray,
  toRecordId,
  withTimestampFields,
} from '@/services/pocketbase-rest/pocketBaseRestClient.utils';

export class PocketBaseRestClient {
  private readonly fetcher: Fetcher;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: PocketBaseRestClientOptions) {
    const raw = options.fetcher ?? fetch;
    this.fetcher = (...args: Parameters<Fetcher>) => raw(...args);
    this.baseUrl = normalizePocketBaseBaseUrl(
      options.useAuthGateway === false ? options.projectUrl : resolvePocketBaseBaseUrl(),
    );
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
          credentials: 'same-origin',
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
        credentials: 'same-origin',
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
            credentials: 'same-origin',
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
        credentials: 'same-origin',
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
