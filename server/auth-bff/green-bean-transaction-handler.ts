import type { IncomingMessage, ServerResponse } from 'node:http';

import { getAuthenticatedToken } from './auth-common.js';
import { sendJson } from './http.js';
import { proxyPocketBaseRequest, sendUpstreamError } from './pocketbase-client.js';

const GREEN_BEAN_TRANSACTION_PATH = /^\/api\/green-beans\/([^/]+)$/;

const ALLOWED_ROAST_PLAN_DISPOSITIONS = new Set(['delete', 'makeGeneric']);

/**
 * 生豆级联删除代理：转发到 PocketBase 扩展的事务端点，
 * 由服务端在单个事务内完成全部级联删除，避免客户端串行删除
 * 中途失败留下半删状态。
 */
export const handleGreenBeanTransactionRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<boolean> => {
  const match = GREEN_BEAN_TRANSACTION_PATH.exec(requestUrl.pathname);

  if (!match) return false;

  if (request.method !== 'DELETE') {
    sendJson(response, 405, { message: 'Method Not Allowed' });
    return true;
  }

  const token = getAuthenticatedToken(request, response);
  if (!token) return true;

  const beanId = match[1];
  const dispositionRaw = requestUrl.searchParams.get('roastPlanDisposition') ?? 'delete';
  const disposition = ALLOWED_ROAST_PLAN_DISPOSITIONS.has(dispositionRaw) ? dispositionRaw : 'delete';
  const upstreamPath = `/api/easybake/green-beans/${encodeURIComponent(beanId)}?roastPlanDisposition=${encodeURIComponent(disposition)}`;

  const upstream = await proxyPocketBaseRequest(upstreamPath, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'DELETE',
  });

  if (!upstream.response.ok) {
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return true;
  }

  sendJson(response, upstream.response.status, upstream.payload);
  return true;
};
