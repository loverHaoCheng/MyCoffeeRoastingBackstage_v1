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
  verified?: unknown;
  username?: unknown;
}

interface SessionUser {
  email: string;
  id: string;
  verified?: boolean;
  username?: string;
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

  const loginResponse = await proxyPocketBaseRequest(
    `/api/collections/${authCollection}/auth-with-password`,
    {
      body: JSON.stringify({
        identity: email,
        password,
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  if (!loginResponse.response.ok) {
    sendUpstreamError(response, loginResponse.response.status, loginResponse.payload);
    return;
  }

  const authResponse = normalizeAuthResponse(loginResponse.payload);

  if (!authResponse) {
    sendJson(response, 502, {
      message: 'PocketBase 注册后的登录响应缺少必要字段。',
    });
    return;
  }

  setAuthCookie(response, request, authResponse.token);
  sendJson(response, 200, authResponse);
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

  setAuthCookie(response, request, authResponse.token);
  sendJson(response, 200, authResponse);
};

const handleLogout = (request: IncomingMessage, response: ServerResponse): void => {
  clearAuthCookie(response, request);
  sendJson(response, 200, {
    success: true,
  });
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

  if (requestUrl.pathname === '/api/auth/logout') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    handleLogout(request, response);
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
