import type { IncomingMessage, ServerResponse } from 'node:http';

import { requestEmailAction, sendClientSession, sendUnverifiedResponse, toGenericEmailActionResult } from './auth-common.js';
import { authCollection } from './config.js';
import { clearAuthCookie, getAuthCookieValue, parseJsonBody, sendJson, setAuthCookie } from './http.js';
import { normalizeAuthResponse, normalizeUser, proxyPocketBaseRequest, sendUpstreamError } from './pocketbase-client.js';
import { isRecord, toTrimmedString } from './utils.js';

export const handleLogin = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const body = await parseJsonBody(request);

  if (!isRecord(body)) {
    sendJson(response, 400, {
      message: '登录请求缺少有效参数。',
    });
    return;
  }

  const identity = toTrimmedString(body.identity);
  const password = toTrimmedString(body.password);

  if (!identity || !password) {
    sendJson(response, 400, {
      message: '邮箱和密码不能为空。',
    });
    return;
  }

  const upstream = await proxyPocketBaseRequest(
    `/api/collections/${authCollection}/auth-with-password`,
    {
      body: JSON.stringify({
        identity,
        password,
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  if (!upstream.response.ok) {
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return;
  }

  const authResponse = normalizeAuthResponse(upstream.payload);

  if (!authResponse) {
    sendJson(response, 502, {
      message: 'PocketBase 登录响应缺少必要字段。',
    });
    return;
  }

  if (authResponse.record.verified !== true) {
    sendUnverifiedResponse(response, request, authResponse.record.email);
    return;
  }

  setAuthCookie(response, request, authResponse.token);
  sendClientSession(response, 200, authResponse.record);
};

export const handleRegister = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const body = await parseJsonBody(request);

  if (!isRecord(body)) {
    sendJson(response, 400, {
      message: '注册请求缺少有效参数。',
    });
    return;
  }

  const email = toTrimmedString(body.email);
  const password = toTrimmedString(body.password);
  const passwordConfirm = toTrimmedString(body.passwordConfirm);

  if (!email || !password || !passwordConfirm) {
    sendJson(response, 400, {
      message: '注册信息不能为空。',
    });
    return;
  }

  const createResponse = await proxyPocketBaseRequest(`/api/collections/${authCollection}/records`, {
    body: JSON.stringify({
      email,
      name: email,
      password,
      passwordConfirm,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!createResponse.response.ok) {
    sendUpstreamError(response, createResponse.response.status, createResponse.payload);
    return;
  }

  const verificationResponse = await requestEmailAction('request-verification', email);

  if (!verificationResponse.response.ok) {
    sendJson(response, 201, {
      email,
      message: '账号已创建，但验证邮件发送失败，请稍后在登录页重新发送验证邮件。',
      verificationEmailSent: false,
      verificationRequired: true,
    });
    return;
  }

  clearAuthCookie(response, request);
  sendJson(response, 201, {
    email,
    message: '注册成功，验证邮件已发送，请先完成邮箱验证后再登录。',
    verificationEmailSent: true,
    verificationRequired: true,
  });
};

export const handleSession = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const token = getAuthCookieValue(request);

  if (!token) {
    clearAuthCookie(response, request);
    sendJson(response, 401, {
      message: '未找到登录态，请重新登录。',
    });
    return;
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
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return;
  }

  const authResponse = normalizeAuthResponse(upstream.payload);

  if (!authResponse) {
    clearAuthCookie(response, request);
    sendJson(response, 502, {
      message: 'PocketBase 会话刷新响应缺少必要字段。',
    });
    return;
  }

  if (authResponse.record.verified !== true) {
    sendUnverifiedResponse(response, request, authResponse.record.email);
    return;
  }

  setAuthCookie(response, request, authResponse.token);
  sendClientSession(response, 200, authResponse.record);
};

export const handleUpdateProfile = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const token = getAuthCookieValue(request);

  if (!token) {
    clearAuthCookie(response, request);
    sendJson(response, 401, {
      message: '未找到登录态，请重新登录。',
    });
    return;
  }

  const body = await parseJsonBody(request);

  if (!isRecord(body) || typeof body.name !== 'string') {
    sendJson(response, 400, {
      message: '昵称更新请求缺少有效参数。',
    });
    return;
  }

  const name = toTrimmedString(body.name);

  if (name.length > 40) {
    sendJson(response, 400, {
      message: '昵称不能超过 40 个字符。',
    });
    return;
  }

  const sessionUpstream = await proxyPocketBaseRequest(`/api/collections/${authCollection}/auth-refresh`, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'POST',
  });

  if (!sessionUpstream.response.ok) {
    clearAuthCookie(response, request);
    sendUpstreamError(response, sessionUpstream.response.status, sessionUpstream.payload);
    return;
  }

  const authResponse = normalizeAuthResponse(sessionUpstream.payload);

  if (!authResponse) {
    clearAuthCookie(response, request);
    sendJson(response, 502, {
      message: 'PocketBase 会话刷新响应缺少必要字段。',
    });
    return;
  }

  if (authResponse.record.verified !== true) {
    sendUnverifiedResponse(response, request, authResponse.record.email);
    return;
  }

  const updateUpstream = await proxyPocketBaseRequest(
    `/api/collections/${authCollection}/records/${authResponse.record.id}`,
    {
      body: JSON.stringify({
        name,
      }),
      headers: {
        Accept: 'application/json',
        Authorization: authResponse.token,
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    },
  );

  if (!updateUpstream.response.ok) {
    sendUpstreamError(response, updateUpstream.response.status, updateUpstream.payload);
    return;
  }

  const updatedRecord = isRecord(updateUpstream.payload)
    ? normalizeUser(updateUpstream.payload)
    : null;

  if (!updatedRecord) {
    sendJson(response, 502, {
      message: 'PocketBase 昵称更新响应缺少必要字段。',
    });
    return;
  }

  setAuthCookie(response, request, authResponse.token);
  sendClientSession(response, 200, updatedRecord);
};

export const handleRequestVerification = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const body = await parseJsonBody(request);

  if (!isRecord(body)) {
    sendJson(response, 400, {
      message: '重发验证邮件请求缺少有效参数。',
    });
    return;
  }

  const email = toTrimmedString(body.email);

  if (!email) {
    sendJson(response, 400, {
      message: '邮箱不能为空。',
    });
    return;
  }

  const upstream = await requestEmailAction('request-verification', email);

  if (!upstream.response.ok && upstream.response.status >= 500) {
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return;
  }

  sendJson(
    response,
    200,
    toGenericEmailActionResult('如果该邮箱已注册，验证邮件已发送，请注意查收。'),
  );
};

export const handleConfirmVerification = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const body = await parseJsonBody(request);

  if (!isRecord(body)) {
    sendJson(response, 400, {
      message: '验证链接缺少有效参数。',
    });
    return;
  }

  const token = toTrimmedString(body.token);

  if (!token) {
    sendJson(response, 400, {
      message: '验证链接无效或已过期，请返回登录页重新发送验证邮件。',
    });
    return;
  }

  const upstream = await proxyPocketBaseRequest(
    `/api/collections/${authCollection}/confirm-verification`,
    {
      body: JSON.stringify({ token }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  if (!upstream.response.ok) {
    if (upstream.response.status < 500) {
      sendJson(response, upstream.response.status, {
        message: '验证链接无效或已过期，请返回登录页重新发送验证邮件。',
      });
      return;
    }

    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return;
  }

  sendJson(response, 200, {
    message: '邮箱验证成功，现在可以登录 EasyBake。',
    success: true,
  });
};

export const handleRequestPasswordReset = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const body = await parseJsonBody(request);

  if (!isRecord(body)) {
    sendJson(response, 400, {
      message: '找回密码请求缺少有效参数。',
    });
    return;
  }

  const email = toTrimmedString(body.email);

  if (!email) {
    sendJson(response, 400, {
      message: '邮箱不能为空。',
    });
    return;
  }

  const upstream = await requestEmailAction('request-password-reset', email);

  if (!upstream.response.ok && upstream.response.status >= 500) {
    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return;
  }

  sendJson(
    response,
    200,
    toGenericEmailActionResult('如果该邮箱已注册，重置密码邮件已发送，请注意查收。'),
  );
};

export const handleConfirmPasswordReset = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const body = await parseJsonBody(request);

  if (!isRecord(body)) {
    sendJson(response, 400, {
      message: '重置链接缺少有效参数。',
    });
    return;
  }

  const token = toTrimmedString(body.token);
  const password = toTrimmedString(body.password);
  const passwordConfirm = toTrimmedString(body.passwordConfirm);

  if (!token) {
    sendJson(response, 400, {
      message: '重置链接无效或已过期，请重新发起找回密码。',
    });
    return;
  }

  if (password.length < 8 || passwordConfirm.length < 8) {
    sendJson(response, 400, {
      message: '新密码至少需要 8 位。',
    });
    return;
  }

  if (password !== passwordConfirm) {
    sendJson(response, 400, {
      message: '两次输入的密码不一致。',
    });
    return;
  }

  const upstream = await proxyPocketBaseRequest(
    `/api/collections/${authCollection}/confirm-password-reset`,
    {
      body: JSON.stringify({
        password,
        passwordConfirm,
        token,
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  if (!upstream.response.ok) {
    if (upstream.response.status < 500) {
      sendJson(response, upstream.response.status, {
        message: '重置链接无效或已过期，请重新发起找回密码。',
      });
      return;
    }

    sendUpstreamError(response, upstream.response.status, upstream.payload);
    return;
  }

  sendJson(response, 200, {
    message: '密码已重置，现在可以使用新密码登录。',
    success: true,
  });
};

export const handleLogout = (request: IncomingMessage, response: ServerResponse): void => {
  clearAuthCookie(response, request);
  sendJson(response, 200, {
    success: true,
  });
};
