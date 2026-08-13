import type { IncomingMessage, ServerResponse } from 'node:http';

import { getAuthenticatedToken } from './auth-common.js';
import { BUSINESS_COLLECTIONS } from './config.js';
import { parseJsonBody, sendJson, sendMethodNotAllowed } from './http.js';
import { proxyPocketBaseRequest, sendUpstreamError } from './pocketbase-client.js';
import { validateRoastCurveEventOverrideOrder } from './roast-curve-event-validation.js';
import { isRecord, toTrimmedString } from './utils.js';

const inventoryUpdateLocks = new Map<string, Promise<void>>();

const withInventoryUpdateLock = async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
  const previous = inventoryUpdateLocks.get(key) ?? Promise.resolve();
  let release: (() => void) | undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  inventoryUpdateLocks.set(key, queued);
  await previous;

  try {
    return await operation();
  } finally {
    release?.();

    if (inventoryUpdateLocks.get(key) === queued) {
      inventoryUpdateLocks.delete(key);
    }
  }
};

const validateInventoryUpdateVersion = async (
  token: string,
  recordId: string,
  expectedUpdatedAt: string,
): Promise<boolean> => {
  const current = await proxyPocketBaseRequest(`/api/collections/green_bean_purchase_batches/records/${encodeURIComponent(recordId)}`, {
    headers: { Accept: 'application/json', Authorization: token },
    method: 'GET',
  });

  if (!current.response.ok) {
    throw Object.assign(new Error('库存批次读取失败。'), { upstream: current });
  }

  return isRecord(current.payload) && toTrimmedString(current.payload.updated_at) === expectedUpdatedAt;
};

export const handleBusinessCollectionRequest = async (
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

  if (method === 'PATCH' && collectionName === 'green_bean_purchase_batches' && match[2]) {
    if (!isRecord(body) || typeof body.__expected_updated_at !== 'string') {
      sendJson(response, 400, { message: '库存更新必须携带版本信息，请刷新后重试。' });
      return true;
    }

    const expectedUpdatedAt = toTrimmedString(body.__expected_updated_at);
    const payload = { ...body };
    delete payload.__expected_updated_at;

    if (!expectedUpdatedAt) {
      sendJson(response, 400, { message: '库存版本信息无效，请刷新后重试。' });
      return true;
    }

    await withInventoryUpdateLock(match[2], async () => {
      const currentVersionMatches = await validateInventoryUpdateVersion(token, match[2], expectedUpdatedAt);

      if (!currentVersionMatches) {
        sendJson(response, 409, { message: '库存已被其他操作更新，请刷新后重试。' });
        return;
      }

      const upstream = await proxyPocketBaseRequest(`/api/easybake/purchase-batches/${encodeURIComponent(match[2])}`, {
        body: JSON.stringify(body),
        headers: {
          Accept: 'application/json',
          Authorization: token,
          'Content-Type': 'application/json',
        },
        method,
      });

      if (!upstream.response.ok) {
        sendUpstreamError(response, upstream.response.status, upstream.payload);
        return;
      }

      sendJson(response, upstream.response.status, upstream.payload);
    });
    return true;
  }

  if (method === 'PATCH' && collectionName === 'roast_curve_records' && match[2] && isRecord(body) && 'event_overrides' in body) {
    const current = await proxyPocketBaseRequest(
      `/api/collections/roast_curve_records/records/${encodeURIComponent(match[2])}`,
      {
        headers: { Accept: 'application/json', Authorization: token },
        method: 'GET',
      },
    );

    if (!current.response.ok || !isRecord(current.payload)) {
      sendUpstreamError(response, current.response.status, current.payload);
      return true;
    }

    const validationError = validateRoastCurveEventOverrideOrder({ ...current.payload, ...body });

    if (validationError) {
      sendJson(response, 422, { message: validationError });
      return true;
    }
  }

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
