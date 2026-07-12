import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

import { getAuthenticatedToken } from './auth-common.js';
import { REALTIME_SUBSCRIPTIONS } from './config.js';
import { parseJsonBody, parseJsonResponse, sendJson, sendMethodNotAllowed } from './http.js';
import { buildPocketBaseUrl, proxyPocketBaseRequest, sendUpstreamError } from './pocketbase-client.js';
import { isRecord, toTrimmedString } from './utils.js';

export const handleRealtimeRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const token = getAuthenticatedToken(request, response);

  if (!token) {
    return;
  }

  if (request.method === 'POST') {
    const body = await parseJsonBody(request);

    if (!isRecord(body) || typeof body.clientId !== 'string' || !Array.isArray(body.subscriptions)) {
      sendJson(response, 400, {
        message: '实时订阅请求缺少有效参数。',
      });
      return;
    }

    const clientId = toTrimmedString(body.clientId);
    const subscriptions = body.subscriptions.filter(
      (item): item is string => typeof item === 'string' && REALTIME_SUBSCRIPTIONS.has(item),
    );

    if (!clientId || subscriptions.length !== body.subscriptions.length) {
      sendJson(response, 400, {
        message: '实时订阅包含不支持的主题。',
      });
      return;
    }

    const upstream = await proxyPocketBaseRequest('/api/realtime', {
      body: JSON.stringify({
        clientId,
        subscriptions,
      }),
      headers: {
        Accept: 'application/json',
        Authorization: token,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!upstream.response.ok) {
      sendUpstreamError(response, upstream.response.status, upstream.payload);
      return;
    }

    sendJson(response, 200, upstream.payload);
    return;
  }

  if (request.method !== 'GET') {
    sendMethodNotAllowed(response, ['GET', 'POST']);
    return;
  }

  const controller = new AbortController();
  response.once('close', () => {
    controller.abort();
  });
  const upstream = await fetch(buildPocketBaseUrl('/api/realtime'), {
    headers: {
      Accept: 'text/event-stream',
      Authorization: token,
    },
    method: 'GET',
    signal: controller.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const payload = await parseJsonResponse(upstream);
    sendUpstreamError(response, upstream.status, payload);
    return;
  }

  response.writeHead(upstream.status, {
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
    'X-Accel-Buffering': 'no',
  });
  Readable.fromWeb(upstream.body).pipe(response);
};
