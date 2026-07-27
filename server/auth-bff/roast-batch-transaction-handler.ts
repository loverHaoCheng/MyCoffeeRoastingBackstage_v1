import type { IncomingMessage, ServerResponse } from 'node:http';

import { getAuthenticatedToken } from './auth-common.js';
import { parseJsonBody, sendJson } from './http.js';
import { proxyPocketBaseRequest, sendUpstreamError } from './pocketbase-client.js';

const ROAST_BATCH_TRANSACTION_PATH = /^\/api\/roast-batches(?:\/([^/]+))?$/;

export const handleRoastBatchTransactionRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<boolean> => {
  const match = ROAST_BATCH_TRANSACTION_PATH.exec(requestUrl.pathname);

  if (!match) return false;

  const method = request.method ?? 'GET';
  const batchId = match[1];
  const validRequest = (method === 'POST' && !batchId) || ((method === 'PATCH' || method === 'DELETE') && batchId);

  if (!validRequest) {
    sendJson(response, 405, { message: 'Method Not Allowed' });
    return true;
  }

  const token = getAuthenticatedToken(request, response);
  if (!token) return true;

  const body = method === 'DELETE' ? undefined : JSON.stringify(await parseJsonBody(request));
  const upstreamPath = batchId
    ? `/api/easybake/roast-batches/${encodeURIComponent(batchId)}`
    : '/api/easybake/roast-batches/commit';
  const upstream = await proxyPocketBaseRequest(upstreamPath, {
    body,
    headers: {
      Accept: 'application/json',
      Authorization: token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    method,
  });

  if (!upstream.response.ok) {
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return true;
  }

  sendJson(response, upstream.response.status, upstream.payload);
  return true;
};
