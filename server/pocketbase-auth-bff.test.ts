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
  remoteAddress?: string;
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
  remoteAddress = '127.0.0.1',
}: GatewayRequestOptions): IncomingMessage => {
  const request = Readable.from(body ? [body] : []) as IncomingMessage;
  Object.defineProperty(request, 'socket', {
    configurable: true,
    value: { remoteAddress },
  });
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
    vi.unstubAllEnvs();
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
    await expect(requestGateway({ path: '/api/collections/roast_curve_records/records' })).resolves.toMatchObject({
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

  it('proxies finance income collection writes through the business gateway whitelist', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/collections/finance_income_records/records')) {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Accept: 'application/json',
          Authorization: 'session-token',
          'Content-Type': 'application/json',
        });
        expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toMatchObject({
          amount: 128,
          channel: 'retail',
          title: '零售收入',
        });

        return Promise.resolve(new Response(JSON.stringify({ id: 'income-1' }), { status: 200 }));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await requestGateway({
      body: JSON.stringify({
        amount: 128,
        channel: 'retail',
        title: '零售收入',
      }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'easybake_pb_session=session-token',
      },
      method: 'POST',
      path: '/api/collections/finance_income_records/records',
    });

    expect(response).toMatchObject({
      body: { id: 'income-1' },
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('confirms an email verification token through the dedicated auth gateway route', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await requestGateway({
      body: JSON.stringify({ token: 'verification-token' }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      path: '/api/auth/confirm-verification',
    });

    expect(response).toMatchObject({
      body: {
        message: '邮箱验证成功，现在可以登录 EasyBake。',
        success: true,
      },
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8090/api/collections/users/confirm-verification',
      expect.objectContaining({
        body: JSON.stringify({ token: 'verification-token' }),
        method: 'POST',
      }),
    );
  });

  it('confirms a password reset through the dedicated auth gateway route', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await requestGateway({
      body: JSON.stringify({
        password: 'password123',
        passwordConfirm: 'password123',
        token: 'reset-token',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      path: '/api/auth/confirm-password-reset',
    });

    expect(response).toMatchObject({
      body: {
        message: '密码已重置，现在可以使用新密码登录。',
        success: true,
      },
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8090/api/collections/users/confirm-password-reset',
      expect.objectContaining({
        body: JSON.stringify({
          password: 'password123',
          passwordConfirm: 'password123',
          token: 'reset-token',
        }),
        method: 'POST',
      }),
    );
  });

  it('deletes only expired unverified users from a loopback cleanup request', async () => {
    vi.stubEnv('PB_SUPERUSER_EMAIL', 'admin@example.com');
    vi.stubEnv('PB_SUPERUSER_PASSWORD', 'admin-password');
    const expiredCreatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/_superusers/auth-with-password')) {
        return Promise.resolve(new Response(JSON.stringify({
          record: { email: 'admin@example.com', id: 'admin-1' },
          token: 'superuser-token',
        }), { status: 200 }));
      }

      if (url.includes('/api/collections/users/records?')) {
        return Promise.resolve(new Response(JSON.stringify({
          items: [
            { created: expiredCreatedAt, id: 'expired-user', verified: false },
            { created: new Date().toISOString(), id: 'recent-user', verified: false },
          ],
          totalPages: 1,
        }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/users/records/expired-user')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestGateway({
      method: 'POST',
      path: '/internal/jobs/cleanup-unverified-users',
    })).resolves.toMatchObject({
      body: { deletedCount: 1 },
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8090/api/collections/users/records/expired-user',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      'http://127.0.0.1:8090/api/collections/users/records/recent-user',
      expect.anything(),
    );
  });

  it('rejects cleanup requests that do not originate from the server loopback interface', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestGateway({
      method: 'POST',
      path: '/internal/jobs/cleanup-unverified-users',
      remoteAddress: '203.0.113.10',
    })).resolves.toMatchObject({
      body: { message: 'Forbidden' },
      status: 403,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects roast training uploads in production before touching PocketBase', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestGateway({
      body: JSON.stringify({ roastBatchId: 'batch-1' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'easybake_pb_session=session-token',
      },
      method: 'POST',
      path: '/api/ai/roast-training-upload',
    })).resolves.toMatchObject({
      body: {
        code: 403,
        message: '正式环境暂未开放训练上传。',
      },
      status: 403,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates an immutable roast training sample and upload audit record in staging', async () => {
    vi.stubEnv('EASYBAKE_APP_ENV', 'staging');
    const curveData = Array.from({ length: 60 }, (_item, index) => ({
      beanTemperature: 80 + index,
      timeSeconds: index * 10,
    }));
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/collections/users/auth-refresh')) {
        return Promise.resolve(new Response(JSON.stringify({
          record: {
            email: 'test@example.com',
            id: 'user-1',
            verified: true,
          },
          token: 'refreshed-token',
        }), { status: 200 }));
      }

      if (url.includes('/api/collections/roast_training_uploads/records?')) {
        return Promise.resolve(new Response(JSON.stringify({ items: [], totalPages: 1 }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roast_batches/records/batch-1')) {
        return Promise.resolve(new Response(JSON.stringify({
          evaluation: {
            allowTraining: true,
            flavorNotes: '甜感清楚',
            overallScore: 4,
            targetMatchScore: 5,
          },
          green_bean_id: 'bean-1',
          green_bean_name: '测试生豆',
          id: 'batch-1',
          input_weight_grams: 200,
          output_weight_grams: 170,
          roast_level: '手冲浅烘',
          roast_plan_id: 'plan-1',
          roast_plan_name: '测试计划',
        }), { status: 200 }));
      }

      if (url.includes('/api/collections/roast_curve_records/records?')) {
        return Promise.resolve(new Response(JSON.stringify({
          items: [{
            curve_data: curveData,
            id: 'curve-1',
            metrics: {
              developmentRatio: 20,
              roastDuration: 590,
            },
            roast_batch_id: 'batch-1',
            source: 'hibean',
          }],
          totalPages: 1,
        }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/green_beans/records/bean-1')) {
        return Promise.resolve(new Response(JSON.stringify({ id: 'bean-1', name: '测试生豆' }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roast_profiles/records/plan-1')) {
        return Promise.resolve(new Response(JSON.stringify({
          id: 'plan-1',
          name: '测试计划',
          roaster_model: 'tank200d',
          steps: [
            { eventName: '入豆', timeLabel: '0:00' },
            { eventName: '一爆', timeLabel: '7:00' },
            { eventName: '下豆', timeLabel: '9:50' },
          ],
        }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roast_training_samples/records')) {
        expect(init?.method).toBe('POST');
        const payload = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
        expect(payload).toMatchObject({
          owner: 'user-1',
          quality_status: 'pending',
          roast_batch_id: 'batch-1',
          roaster_model: 'tank200d',
        });
        expect(payload.snapshot).toMatchObject({
          ownerId: 'user-1',
          schemaVersion: 1,
        });
        return Promise.resolve(new Response(JSON.stringify({ id: 'sample-1' }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roast_training_samples/records/sample-1')) {
        expect(init?.method).toBe('PATCH');
        const payload = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
        expect(payload).toMatchObject({
          quality_status: 'passed',
        });
        expect(payload.quality_report).toMatchObject({
          errors: [],
          passed: true,
        });
        expect(payload.quality_checked_at).toEqual(expect.any(String));
        return Promise.resolve(new Response(JSON.stringify({ id: 'sample-1' }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roast_training_uploads/records')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toMatchObject({
          owner: 'user-1',
          roast_batch_id: 'batch-1',
          sample_id: 'sample-1',
          status: 'uploaded',
        });
        return Promise.resolve(new Response(JSON.stringify({ id: 'upload-1' }), { status: 200 }));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestGateway({
      body: JSON.stringify({ roastBatchId: 'batch-1' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'easybake_pb_session=session-token',
      },
      method: 'POST',
      path: '/api/ai/roast-training-upload',
    })).resolves.toMatchObject({
      body: {
        code: 0,
        data: {
          quality: {
            status: 'passed',
          },
          sampleId: 'sample-1',
          uploadId: 'upload-1',
        },
        message: 'ok',
      },
      status: 200,
    });
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
