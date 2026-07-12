import type { IncomingMessage, ServerResponse } from 'node:http';

import { authCollection } from './config.js';
import { clearAuthCookie, getAuthCookieValue, sendApiError, sendJson, setAuthCookie } from './http.js';
import { normalizeAuthResponse, normalizeErrorPayload, proxyPocketBaseRequest } from './pocketbase-client.js';
import type { AccountDeletionResult, ClientSessionResponse, EmailActionResult, PocketBaseSessionResponse, SessionUser } from './types.js';

export const sendClientSession = (response: ServerResponse, statusCode: number, record: SessionUser): void => {
  sendJson(response, statusCode, {
    record,
  } satisfies ClientSessionResponse);
};

export const getAuthenticatedToken = (request: IncomingMessage, response: ServerResponse): string | null => {
  const token = getAuthCookieValue(request);

  if (token) {
    return token;
  }

  clearAuthCookie(response, request);
  sendJson(response, 401, {
    message: '未找到登录态，请重新登录。',
  });
  return null;
};

export const requestEmailAction = async (
  action: 'request-password-reset' | 'request-verification',
  email: string,
): Promise<{ payload: unknown; response: Response }> => {
  return proxyPocketBaseRequest(`/api/collections/${authCollection}/${action}`, {
    body: JSON.stringify({
      email,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
};

export const sendUnverifiedResponse = (
  response: ServerResponse,
  request: IncomingMessage,
  email: string,
): void => {
  clearAuthCookie(response, request);
  sendJson(response, 403, {
    code: 'EMAIL_NOT_VERIFIED',
    email,
    message: '该邮箱尚未完成验证，请先前往邮箱完成验证后再登录。',
  });
};

export const toGenericEmailActionResult = (message: string): EmailActionResult => ({
  message,
  success: true,
});

export const toAccountDeletionResult = (message: string): AccountDeletionResult => ({
  message,
  success: true,
});

export const refreshAuthenticatedSession = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<PocketBaseSessionResponse | null> => {
  const token = getAuthCookieValue(request);

  if (!token) {
    clearAuthCookie(response, request);
    sendApiError(response, 401, '未找到登录态，请重新登录。');
    return null;
  }

  const upstream = await proxyPocketBaseRequest(`/api/collections/${authCollection}/auth-refresh`, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'POST',
  });

  if (!upstream.response.ok) {
    clearAuthCookie(response, request);
    sendApiError(response, upstream.response.status, normalizeErrorPayload(upstream.payload).message ?? '登录态已失效。');
    return null;
  }

  const authResponse = normalizeAuthResponse(upstream.payload);

  if (!authResponse) {
    clearAuthCookie(response, request);
    sendApiError(response, 502, 'PocketBase 会话刷新响应缺少必要字段。');
    return null;
  }

  if (authResponse.record.verified !== true) {
    sendUnverifiedResponse(response, request, authResponse.record.email);
    return null;
  }

  setAuthCookie(response, request, authResponse.token);

  return authResponse;
};
