import type { IncomingMessage, ServerResponse } from 'node:http';

import { getAuthenticatedToken } from './auth-common.js';
import { BUSINESS_COLLECTIONS } from './config.js';
import { parseJsonBody, sendJson, sendMethodNotAllowed } from './http.js';
import { proxyPocketBaseRequest, sendUpstreamError } from './pocketbase-client.js';

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
