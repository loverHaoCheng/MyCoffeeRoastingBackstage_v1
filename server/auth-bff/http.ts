import type { IncomingMessage, ServerResponse } from 'node:http';

import { authCookieName, cookieMaxAgeSeconds } from './config.js';

export const parseJsonBody = async (request: IncomingMessage): Promise<unknown> => {
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

export const parseJsonResponse = async (response: Response): Promise<unknown> => {
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

export const readRequestBuffer = async (
  request: IncomingMessage,
  options: {
    maxBytes: number;
  },
): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunkValue of request) {
    const chunk =
      typeof chunkValue === 'string'
        ? Buffer.from(chunkValue)
        : chunkValue instanceof Uint8Array
          ? Buffer.from(chunkValue)
          : Buffer.alloc(0);

    receivedBytes += chunk.byteLength;

    if (receivedBytes > options.maxBytes) {
      throw new Error('图片数据过大，请压缩到 6MB 以内后重试。');
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

export const parseLimitedJsonBody = async (
  request: IncomingMessage,
  options: {
    maxBytes: number;
  },
): Promise<unknown> => {
  const rawBody = (await readRequestBuffer(request, options)).toString('utf8').trim();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('请求体不是有效的 JSON。');
  }
};

export const sendApiSuccess = (response: ServerResponse, data: unknown): void => {
  sendJson(response, 200, {
    code: 0,
    data,
    message: 'ok',
  });
};

export const sendApiError = (
  response: ServerResponse,
  statusCode: number,
  message: string,
  data: Record<string, unknown> = {},
): void => {
  sendJson(response, statusCode, {
    code: statusCode,
    data,
    message,
  });
};

export const hasSecureForwardedProto = (request: IncomingMessage): boolean => {
  if (process.env.PB_AUTH_COOKIE_SECURE === 'true') {
    return true;
  }

  const forwardedProto = request.headers['x-forwarded-proto'];

  if (Array.isArray(forwardedProto)) {
    return forwardedProto.some((value) => value.trim().toLowerCase() === 'https');
  }

  return typeof forwardedProto === 'string' && forwardedProto.trim().toLowerCase() === 'https';
};

export const serializeCookie = (
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

export const parseCookies = (headerValue: string | string[] | undefined): Record<string, string> => {
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

export const getAuthCookieValue = (request: IncomingMessage): string => {
  const cookies = parseCookies(request.headers.cookie);

  return cookies[authCookieName] ?? '';
};

export const setAuthCookie = (response: ServerResponse, request: IncomingMessage, token: string): void => {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(authCookieName, token, {
      maxAgeSeconds: cookieMaxAgeSeconds,
      secure: hasSecureForwardedProto(request),
    }),
  );
};

export const clearAuthCookie = (response: ServerResponse, request: IncomingMessage): void => {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(authCookieName, '', {
      maxAgeSeconds: 0,
      secure: hasSecureForwardedProto(request),
    }),
  );
};

export const sendJson = (
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

export const sendMethodNotAllowed = (response: ServerResponse, allowedMethods: string[]): void => {
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
