import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';

interface PocketBaseSessionResponse {
  record: SessionUser;
  token: string;
}

interface PocketBaseErrorPayload {
  data?: Record<string, unknown>;
  message?: string;
}

interface PocketBaseUserRecord {
  email?: unknown;
  id?: unknown;
  name?: unknown;
  verified?: unknown;
  username?: unknown;
}

interface SessionUser {
  email: string;
  id: string;
  name?: string;
  verified?: boolean;
  username?: string;
}

interface EmailActionResult {
  message: string;
  success: true;
}

interface AccountDeletionResult {
  message: string;
  success: true;
}

class PocketBaseGatewayError extends Error {
  payload: unknown;
  status: number;

  constructor(status: number, payload: unknown, message?: string) {
    super(message ?? `PocketBase 请求失败：${String(status)}`);
    this.name = 'PocketBaseGatewayError';
    this.payload = payload;
    this.status = status;
  }
}

interface PocketBaseListResponseItem {
  id?: unknown;
}

const DEFAULT_POCKETBASE_URL = 'http://81.70.224.75';
const DEFAULT_AUTH_COLLECTION = 'users';
const DEFAULT_AUTH_COOKIE_NAME = 'easybake_pb_session';
const DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_PORT = 3001;

const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed.replace(/\/+$/, '') : DEFAULT_POCKETBASE_URL;
};

const authCollection = (process.env.PB_AUTH_COLLECTION ?? DEFAULT_AUTH_COLLECTION).trim() || DEFAULT_AUTH_COLLECTION;
const authCookieName =
  (process.env.PB_AUTH_COOKIE_NAME ?? DEFAULT_AUTH_COOKIE_NAME).trim() || DEFAULT_AUTH_COOKIE_NAME;
const cookieMaxAgeCandidate = Number.parseInt(
  (process.env.PB_AUTH_COOKIE_MAX_AGE_SECONDS ?? String(DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS)).trim(),
  10,
);
const cookieMaxAgeSeconds =
  Number.isFinite(cookieMaxAgeCandidate) && cookieMaxAgeCandidate >= 0
    ? cookieMaxAgeCandidate
    : DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS;
const pocketBaseBaseUrl = normalizeBaseUrl(process.env.PB_BASE_URL ?? DEFAULT_POCKETBASE_URL);
const portCandidate = Number.parseInt((process.env.PORT ?? String(DEFAULT_PORT)).trim(), 10);
const port = Number.isFinite(portCandidate) && portCandidate > 0 ? portCandidate : DEFAULT_PORT;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value != null;
};

const toTrimmedString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const buildPocketBaseUrl = (path: string): string => {
  return new URL(path, `${pocketBaseBaseUrl}/`).toString();
};

const parseJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunkValue of request) {
    const chunk: unknown = chunkValue;

    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    }
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('请求体不是有效的 JSON。');
  }
};

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const rawBody = await response.text();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
};

const normalizeUser = (record: PocketBaseUserRecord): SessionUser | null => {
  const id = toTrimmedString(record.id);
  const email = toTrimmedString(record.email);

  if (!id || !email) {
    return null;
  }

  return {
    email,
    id,
    name: toTrimmedString(record.name) || undefined,
    verified: typeof record.verified === 'boolean' ? record.verified : undefined,
    username: toTrimmedString(record.username) || undefined,
  };
};

const normalizeAuthResponse = (payload: unknown): PocketBaseSessionResponse | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const token = toTrimmedString(payload.token);
  const record = isRecord(payload.record) ? (payload.record as PocketBaseUserRecord) : null;

  if (!token || !record) {
    return null;
  }

  const user = normalizeUser(record);

  if (!user) {
    return null;
  }

  return {
    record: user,
    token,
  };
};

const normalizeErrorPayload = (payload: unknown): PocketBaseErrorPayload => {
  if (!isRecord(payload)) {
    return {};
  }

  return {
    data: isRecord(payload.data) ? payload.data : undefined,
    message: toTrimmedString(payload.message) || undefined,
  };
};

const normalizeListResponse = (payload: unknown): { items: { id: string }[]; totalPages: number } | null => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return null;
  }

  const items = payload.items
    .map((item) => {
      const record = isRecord(item) ? (item as PocketBaseListResponseItem) : null;
      const id = record ? toTrimmedString(record.id) : '';

      return id ? { id } : null;
    })
    .filter((item): item is { id: string } => item != null);
  const totalPages =
    typeof payload.totalPages === 'number' && Number.isFinite(payload.totalPages) && payload.totalPages > 0
      ? Math.floor(payload.totalPages)
      : 1;

  return {
    items,
    totalPages,
  };
};

const hasSecureForwardedProto = (request: IncomingMessage): boolean => {
  if (process.env.PB_AUTH_COOKIE_SECURE === 'true') {
    return true;
  }

  const forwardedProto = request.headers['x-forwarded-proto'];

  if (Array.isArray(forwardedProto)) {
    return forwardedProto.some((value) => value.trim().toLowerCase() === 'https');
  }

  return typeof forwardedProto === 'string' && forwardedProto.trim().toLowerCase() === 'https';
};

const serializeCookie = (
  name: string,
  value: string,
  options: {
    maxAgeSeconds?: number;
    secure?: boolean;
  } = {},
): string => {
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (typeof options.maxAgeSeconds === 'number' && Number.isFinite(options.maxAgeSeconds)) {
    segments.push(`Max-Age=${String(Math.max(0, Math.floor(options.maxAgeSeconds)))}`);
  }

  if (options.secure) {
    segments.push('Secure');
  }

  return segments.join('; ');
};

const parseCookies = (headerValue: string | string[] | undefined): Record<string, string> => {
  if (typeof headerValue !== 'string' || headerValue.trim().length === 0) {
    return {};
  }

  return Object.fromEntries(
    headerValue.split(';').map((entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex < 0) {
        return [entry.trim(), ''];
      }

      const cookieName = entry.slice(0, separatorIndex).trim();
      const cookieValue = entry.slice(separatorIndex + 1).trim();

      try {
        return [cookieName, decodeURIComponent(cookieValue)];
      } catch {
        return [cookieName, cookieValue];
      }
    }),
  );
};

const getAuthCookieValue = (request: IncomingMessage): string => {
  const cookies = parseCookies(request.headers.cookie);

  return cookies[authCookieName] ?? '';
};

const setAuthCookie = (response: ServerResponse, request: IncomingMessage, token: string): void => {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(authCookieName, token, {
      maxAgeSeconds: cookieMaxAgeSeconds,
      secure: hasSecureForwardedProto(request),
    }),
  );
};

const clearAuthCookie = (response: ServerResponse, request: IncomingMessage): void => {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(authCookieName, '', {
      maxAgeSeconds: 0,
      secure: hasSecureForwardedProto(request),
    }),
  );
};

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): void => {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(body));
};

const sendMethodNotAllowed = (response: ServerResponse, allowedMethods: string[]): void => {
  sendJson(
    response,
    405,
    {
      message: 'Method Not Allowed',
    },
    {
      Allow: allowedMethods.join(', '),
    },
  );
};

const sendUpstreamError = (response: ServerResponse, statusCode: number, payload: unknown): void => {
  const normalizedError = normalizeErrorPayload(payload);
  const message =
    normalizedError.message && normalizedError.message.length > 0
      ? normalizedError.message
      : `PocketBase 请求失败：${String(statusCode)}`;

  sendJson(response, statusCode, {
    ...normalizedError,
    message,
  });
};

const proxyPocketBaseRequest = async (
  path: string,
  init: RequestInit,
): Promise<{ payload: unknown; response: Response }> => {
  const response = await fetch(buildPocketBaseUrl(path), init);
  const payload = await parseJsonResponse(response);

  return {
    payload,
    response,
  };
};

const requestEmailAction = async (
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

const sendUnverifiedResponse = (
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

const toGenericEmailActionResult = (message: string): EmailActionResult => ({
  message,
  success: true,
});

const toAccountDeletionResult = (message: string): AccountDeletionResult => ({
  message,
  success: true,
});

const escapeFilterValue = (value: string): string => {
  return `'${value.replaceAll("'", "\\'")}'`;
};

const buildRecordListPath = (
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

const isOptionalCollectionMissing = (statusCode: number, payload: unknown): boolean => {
  if (statusCode === 404) {
    return true;
  }

  const message = normalizeErrorPayload(payload).message?.trim().toLowerCase() ?? '';

  return message.includes('not found') || message.includes('missing');
};

const listRecordIdsByFilter = async (
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

const deleteRecordById = async (
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

const deleteRecordsByOwner = async (
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

const handleLogin = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
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
  sendJson(response, 200, authResponse);
};

const handleRegister = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
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

const handleSession = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
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
  sendJson(response, 200, authResponse);
};

const handleUpdateProfile = async (
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

  const nextAuthResponse: PocketBaseSessionResponse = {
    record: updatedRecord,
    token: authResponse.token,
  };

  setAuthCookie(response, request, authResponse.token);
  sendJson(response, 200, nextAuthResponse);
};

const handleRequestVerification = async (
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

const handleRequestPasswordReset = async (
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

const handleLogout = (request: IncomingMessage, response: ServerResponse): void => {
  clearAuthCookie(response, request);
  sendJson(response, 200, {
    success: true,
  });
};

const handleDeleteAccount = async (
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

  const deletionTargets: { filterField?: string; name: string; optional?: boolean }[] = [
    { name: 'finance_expense_records' },
    { name: 'finance_income_records', optional: true },
    { name: 'cost_calculations' },
    { name: 'coffee_beans', optional: true },
    { name: 'bean_sale_specs', optional: true },
    { name: 'roast_batches', optional: true },
    { name: 'roast_profiles' },
    { name: 'roast_records' },
    { name: 'green_bean_purchase_batches' },
    { name: 'green_beans' },
    { name: 'app_settings', optional: true },
  ];

  try {
    for (const target of deletionTargets) {
      await deleteRecordsByOwner(authResponse.token, target.name, authResponse.record.id, {
        filterField: target.filterField,
        optional: target.optional,
      });
    }

    const deleteUserUpstream = await proxyPocketBaseRequest(
      `/api/collections/${authCollection}/records/${authResponse.record.id}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: authResponse.token,
        },
        method: 'DELETE',
      },
    );

    if (!deleteUserUpstream.response.ok && deleteUserUpstream.response.status !== 404) {
      sendUpstreamError(response, deleteUserUpstream.response.status, deleteUserUpstream.payload);
      return;
    }
  } catch (error) {
    const upstreamError =
      error instanceof PocketBaseGatewayError
        ? error
        : null;

    if (upstreamError) {
      sendUpstreamError(response, upstreamError.status, upstreamError.payload);
      return;
    }

    sendJson(response, 500, {
      message: '账号注销失败，请稍后重试。',
    });
    return;
  }

  clearAuthCookie(response, request);
  sendJson(response, 200, toAccountDeletionResult('账号已注销，所有关联数据已删除。'));
};

const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');

  if (requestUrl.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, {
      ok: true,
    });
    return;
  }

  if (requestUrl.pathname === '/api/auth/login') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    await handleLogin(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/register') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    await handleRegister(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/session') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }

    await handleSession(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/request-verification') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    await handleRequestVerification(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/request-password-reset') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    await handleRequestPasswordReset(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/profile') {
    if (request.method !== 'PATCH') {
      sendMethodNotAllowed(response, ['PATCH']);
      return;
    }

    await handleUpdateProfile(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/logout') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    handleLogout(request, response);
    return;
  }

  if (requestUrl.pathname === '/api/auth/account') {
    if (request.method !== 'DELETE') {
      sendMethodNotAllowed(response, ['DELETE']);
      return;
    }

    await handleDeleteAccount(request, response);
    return;
  }

  sendJson(response, 404, {
    message: 'Not Found',
  });
};

export const handleAuthGatewayRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  await handleRequest(request, response).catch((error: unknown) => {
    if (response.headersSent) {
      response.destroy(error instanceof Error ? error : undefined);
      return;
    }

    const message = error instanceof Error && error.message.trim().length > 0 ? error.message : '登录网关服务异常。';

    sendJson(response, 500, {
      message,
    });
  });
};

const isDirectExecution = (): boolean => {
  const entryPath = process.argv[1];

  return Boolean(entryPath && import.meta.url === pathToFileURL(entryPath).href);
};

const startStandaloneServer = (): void => {
  const server = createServer((request, response) => {
    void handleAuthGatewayRequest(request, response);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    const message =
      error.code === 'EADDRINUSE'
        ? `PocketBase auth BFF 启动失败：127.0.0.1:${String(port)} 已被占用。`
        : `PocketBase auth BFF 启动失败：${error.message}`;

    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });

  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`PocketBase auth BFF is listening on http://127.0.0.1:${String(port)}\n`);
  });
};

if (isDirectExecution()) {
  startStandaloneServer();
}
