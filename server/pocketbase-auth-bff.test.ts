// @vitest-environment node

import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleAuthGatewayRequest } from './pocketbase-auth-bff.js';

interface GatewayResponse {
  body: unknown;
  headers: Headers;
  status: number;
}

interface GatewayRequestOptions {
  body?: string;
  headers?: Record<string, string>;
  method?: string;
  path: string;
}

class MockServerResponse extends EventEmitter {
  body = '';
  destroyed = false;
  headers = new Map<string, string>();
  headersSent = false;
  statusCode = 200;

  destroy(): this {
    this.destroyed = true;
    return this;
  }

  end(chunk?: string): this {
    if (chunk) {
      this.body += chunk;
    }
    this.headersSent = true;
    return this;
  }

  getHeader(name: string): string | undefined {
    return this.headers.get(name.toLowerCase());
  }

  setHeader(name: string, value: number | string | string[]): this {
    const normalizedValue = Array.isArray(value) ? value.join(', ') : String(value);
    this.headers.set(name.toLowerCase(), normalizedValue);
    return this;
  }

  writeHead(statusCode: number, headers?: Record<string, number | string | string[]>): this {
    this.statusCode = statusCode;
    this.headersSent = true;

    Object.entries(headers ?? {}).forEach(([name, value]) => {
      this.setHeader(name, value);
    });

    return this;
  }
}

const createMockRequest = ({
  body,
  headers = {},
  method = 'GET',
  path,
}: GatewayRequestOptions): IncomingMessage => {
  const request = Readable.from(body ? [body] : []) as IncomingMessage;
  request.headers = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  request.method = method;
  request.url = path;
  return request;
};

const requestGateway = async (options: GatewayRequestOptions): Promise<GatewayResponse> => {
  const request = createMockRequest(options);
  const response = new MockServerResponse();

  await handleAuthGatewayRequest(request, response as unknown as ServerResponse);

  return {
    body: response.body ? (JSON.parse(response.body) as unknown) : null,
    headers: new Headers(Object.fromEntries(response.headers)),
    status: response.statusCode,
  };
};

describe('PocketBase auth BFF contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the health contract without touching PocketBase', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestGateway({ path: '/api/health' })).resolves.toMatchObject({
      body: { ok: true },
      status: 200,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated collection and realtime requests before proxying upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestGateway({ path: '/api/collections/green_beans/records' })).resolves.toMatchObject({
      body: { message: '未找到登录态，请重新登录。' },
      status: 401,
    });
    await expect(requestGateway({ method: 'POST', path: '/api/realtime' })).resolves.toMatchObject({
      body: { message: '未找到登录态，请重新登录。' },
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-whitelisted collections and unsupported auth methods', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestGateway({ path: '/api/collections/users/records' })).resolves.toMatchObject({
      body: { message: 'Not Found' },
      status: 404,
    });

    const response = await requestGateway({ path: '/api/auth/login' });

    expect(response).toMatchObject({
      body: { message: 'Method Not Allowed' },
      status: 405,
    });
    expect(response.headers.get('allow')).toBe('POST');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stores the upstream token only in a secure HttpOnly cookie after login', async () => {
    const upstreamToken = 'server-only-token';
    const fetchMock = vi.fn(() =>
      new Response(
        JSON.stringify({
          record: {
            email: 'test@example.com',
            id: 'user-1',
            name: 'Test User',
            verified: true,
          },
          token: upstreamToken,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await requestGateway({
      body: JSON.stringify({ identity: 'test@example.com', password: 'password123' }),
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-Proto': 'https',
      },
      method: 'POST',
      path: '/api/auth/login',
    });

    expect(response.status, `BFF response: ${JSON.stringify(response.body)}`).toBe(200);
    expect(response.body).toEqual({
      record: {
        email: 'test@example.com',
        id: 'user-1',
        name: 'Test User',
        verified: true,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(upstreamToken);
    const cookie = response.headers.get('set-cookie') ?? '';

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8090/api/collections/users/auth-with-password',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
