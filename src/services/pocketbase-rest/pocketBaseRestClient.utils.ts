import { pocketBaseSessionService } from '@/services/pocketBaseSession.service';
import { normalizePocketBaseBaseUrl } from '@/services/pocketBaseConfig';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_PAGE_SIZE = 200;

const COLLECTION_ALIASES: Record<string, string> = {
  roast_batch_overview: 'roast_batches',
  roast_plan_overview: 'roast_profiles',
};

export const shouldAttachAbortSignal = (): boolean => {
  return typeof window !== 'undefined';
};

export const isConfigured = (baseUrl: string): boolean => {
  return normalizePocketBaseBaseUrl(baseUrl).length > 0;
};

export const buildCollectionUrl = (baseUrl: string, collectionName: string, path = ''): string => {
  const resolvedCollectionName = COLLECTION_ALIASES[collectionName] ?? collectionName;

  return new URL(`/api/collections/${resolvedCollectionName}/records${path}`, normalizePocketBaseBaseUrl(baseUrl)).toString();
};

const escapeFilterValue = (value: string): string => {
  return `'${value.replaceAll("'", "\\'")}'`;
};

export const buildFilterExpression = (
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

export const toRecordArray = <T,>(payload: unknown): T[] => {
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

export const resolveOwnerId = (): string | undefined => {
  return pocketBaseSessionService.getUser()?.id;
};

export const getRequestHeaders = (): HeadersInit => {
  return {
    Accept: 'application/json',
  };
};

export const mergeHeaders = (...headerSets: (HeadersInit | undefined)[]): Headers => {
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

export const toRecordId = (record: Record<string, unknown>): string => {
  const { id } = record;

  return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
};

export const withTimestampFields = (
  payload: Record<string, unknown>,
  mode: 'insert' | 'update',
): Record<string, unknown> => {
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
