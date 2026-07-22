import { normalizeErrorPayload, normalizeListResponse, proxyPocketBaseRequest } from './pocketbase-client.js';
import { PocketBaseGatewayError } from './types.js';
import { isRecord } from './utils.js';

export const escapeFilterValue = (value: string): string => {
  return `'${value.replaceAll("'", "\\'")}'`;
};

export const buildRecordListPath = (
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

export const isOptionalCollectionMissing = (statusCode: number, payload: unknown): boolean => {
  if (statusCode === 404) {
    return true;
  }

  const message = normalizeErrorPayload(payload).message?.trim().toLowerCase() ?? '';

  return message.includes('not found') || message.includes('missing');
};

export const listRecordIdsByFilter = async (
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

export const deleteRecordById = async (
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

export const deleteRecordsByOwner = async (
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

export const listPocketBaseRecords = async (
  token: string,
  collectionName: string,
  options: {
    fields?: string;
    filter?: string;
    page?: number;
    perPage?: number;
    sort?: string;
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

  if (options.sort) {
    searchParams.set('sort', options.sort);
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

export const getFirstListItem = (payload: unknown): Record<string, unknown> | null => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return null;
  }

  const firstItem = payload.items[0] as unknown;

  return isRecord(firstItem) ? firstItem : null;
};
