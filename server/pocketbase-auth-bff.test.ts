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

  it('creates a private roast review and excludes an unconsented sample from public training in production', async () => {
    vi.stubEnv('EASYBAKE_APP_ENV', 'production');
    vi.stubEnv('AI_ROAST_API_KEY', 'test-ai-key');
    vi.stubEnv('AI_ROAST_MODEL', 'deepseek/deepseek-v4-pro-202606');
    vi.stubEnv('PB_SUPERUSER_EMAIL', 'admin@example.com');
    vi.stubEnv('PB_SUPERUSER_PASSWORD', 'admin-password');
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

      if (url.endsWith('/api/collections/_superusers/auth-with-password')) {
        return Promise.resolve(new Response(JSON.stringify({
          record: { email: 'admin@example.com', id: 'admin-1', verified: true },
          token: 'superuser-token',
        }), { status: 200 }));
      }

      if (url.includes('/api/collections/ai_usage_limits/records?')) {
        return Promise.resolve(new Response(JSON.stringify({ items: [], totalPages: 1 }), { status: 200 }));
      }

      if (url.includes('/api/collections/ai_usage_logs/records?')) {
        return Promise.resolve(new Response(JSON.stringify({ items: [], totalPages: 1 }), { status: 200 }));
      }

      if (url.includes('/api/collections/roast_training_uploads/records?')) {
        return Promise.resolve(new Response(JSON.stringify({ items: [], totalPages: 1 }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roast_batches/records/batch-1')) {
        return Promise.resolve(new Response(JSON.stringify({
          evaluation: {
            allowTraining: false,
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
          roaster_machine_id: 'machine-1',
          roaster_model: 'tank200d',
          steps: [
            { event: '入豆', time: '0:00' },
            { event: '一爆', time: '7:00' },
            { event: '下豆', time: '9:50' },
          ],
        }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roasting_machines/records/machine-1')) {
        return Promise.resolve(new Response(JSON.stringify({
          display_name: 'Tank200D',
          id: 'machine-1',
          model_key: 'tank200d',
        }), { status: 200 }));
      }

      if (url.endsWith('/chat/completions')) {
        return Promise.resolve(new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  adjustments: [
                    {
                      area: '发展期',
                      observation: '评价显示甜感清楚，但仍需观察后段表现。',
                      priority: 'medium',
                      suggestion: '下次一爆后保持 RoR 平缓下降，并微调出炉点。',
                    },
                  ],
                  confidence: 78,
                  modifiedPlanJson: {
                    batchWeightGrams: 200,
                    beanId: 'bean-1',
                    beanName: '测试生豆',
                    name: '测试计划（建议版）',
                    purpose: '手冲',
                    roastLevel: '手冲浅烘',
                    roasterMachineId: 'machine-1',
                    roasterModel: 'Tank200D',
                    steps: [
                      {
                        airTemperature: '-',
                        drumSpeed: '-',
                        event: '入豆',
                        firePower: '80%',
                        operation: '入豆',
                        temperature: '200°C',
                        time: '0:00',
                      },
                    ],
                  },
                  overallReview: '整体曲线可用，下次应微调发展段。',
                }),
              },
            },
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
          roaster_model: 'Tank200D',
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
          quality_status: 'failed',
        });
        expect(payload.quality_report).toMatchObject({
          errors: ['训练授权未开启。'],
          passed: false,
        });
        expect(payload.quality_checked_at).toEqual(expect.any(String));
        return Promise.resolve(new Response(JSON.stringify({ id: 'sample-1' }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/ai_roast_recommendations/records')) {
        expect(init?.method).toBe('POST');
        const payload = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
        expect(payload).toMatchObject({
          machine_id: 'machine-1',
          owner: 'user-1',
          status: 'draft',
        });
        expect(payload.plan_draft).toMatchObject({
          name: '测试计划（建议版）',
          roasterMachineId: 'machine-1',
        });
        expect(payload.request_context).toMatchObject({
          overallReview: '整体曲线可用，下次应微调发展段。',
          roastBatchId: 'batch-1',
          sampleId: 'sample-1',
        });
        return Promise.resolve(new Response(JSON.stringify({
          id: 'recommendation-1',
          plan_draft: payload.plan_draft,
          request_context: payload.request_context,
          status: 'draft',
        }), { status: 200 }));
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

      if (url.endsWith('/api/collections/ai_usage_logs/records')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toMatchObject({
          feature: 'roast_training_recommendation',
          owner: 'user-1',
          status: 'success',
        });
        return Promise.resolve(new Response(JSON.stringify({ id: 'usage-log-1' }), { status: 200 }));
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
            status: 'failed',
          },
          recommendation: {
            recommendationId: 'recommendation-1',
          },
          sampleId: 'sample-1',
          uploadId: 'upload-1',
          usage: {
            monthlyLimit: 10,
            remainingUses: 9,
            usedThisMonth: 1,
          },
        },
        message: 'ok',
      },
      status: 200,
    });
  });

  it('builds roast analysis input from PocketBase records when the client sends only a batch id', async () => {
    vi.stubEnv('EASYBAKE_APP_ENV', 'production');
    vi.stubEnv('AI_ROAST_API_KEY', 'test-ai-key');
    vi.stubEnv('AI_ROAST_MODEL', 'gpt-5.5');
    vi.stubEnv('PB_SUPERUSER_EMAIL', 'admin@example.com');
    vi.stubEnv('PB_SUPERUSER_PASSWORD', 'admin-password');
    const curveData = [
      { bean_temperature: 100, heat_power: 80, rate_of_rise: 10, time_seconds: 0 },
      { bean_temperature: 150, heat_power: 70, rate_of_rise: 8, time_seconds: 300 },
      { bean_temperature: 196, heat_power: 55, rate_of_rise: 6, time_seconds: 430 },
      { bean_temperature: 204, heat_power: 45, rate_of_rise: 4, time_seconds: 540 },
    ];
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

      if (url.endsWith('/api/collections/_superusers/auth-with-password')) {
        return Promise.resolve(new Response(JSON.stringify({
          record: { email: 'admin@example.com', id: 'admin-1', verified: true },
          token: 'superuser-token',
        }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roast_batches/records/batch-1')) {
        return Promise.resolve(new Response(JSON.stringify({
          evaluation: {
            flavorNotes: '柑橘酸明显，甜感偏薄',
            overallScore: 4,
            targetMatchScore: 3,
          },
          green_bean_id: 'bean-1',
          green_bean_name: '测试生豆',
          id: 'batch-1',
          input_weight_grams: 200,
          output_weight_grams: 168,
          roast_level: '手冲浅烘',
          roast_plan_id: 'plan-1',
          roast_plan_name: '测试计划',
          total_roast_time: 0,
        }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roast_profiles/records/plan-1')) {
        return Promise.resolve(new Response(JSON.stringify({
          batch_weight_grams: 200,
          id: 'plan-1',
          name: '测试计划',
          roaster_machine_id: 'machine-1',
          steps: [
            { eventName: '入豆', firePower: '80%', timeLabel: '0:00' },
            { eventName: '一爆开始', firePower: '55%', timeLabel: '7:10' },
            { eventName: '下豆', firePower: '0%', timeLabel: '9:00' },
          ],
        }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roasting_machines/records/machine-1')) {
        return Promise.resolve(new Response(JSON.stringify({
          configuration: { controls: ['火力'] },
          display_name: 'Tank200D',
          id: 'machine-1',
          model_key: 'tank200d',
        }), { status: 200 }));
      }

      if (url.includes('/api/collections/roast_curve_records/records?')) {
        return Promise.resolve(new Response(JSON.stringify({
          items: [{
            curve_data: curveData,
            id: 'curve-1',
            metrics: {
              development_ratio: 20,
              drop_temperature: 204,
              drop_time: 540,
              first_crack_temperature: 196,
              first_crack_time: 430,
              roast_duration: 540,
            },
            roast_batch_id: 'batch-1',
          }],
          totalPages: 1,
        }), { status: 200 }));
      }

      if (url.includes('/api/collections/ai_roast_reviews/records?')) {
        return Promise.resolve(new Response(JSON.stringify({ items: [], totalPages: 1 }), { status: 200 }));
      }

      if (url.includes('/api/collections/ai_usage_limits/records?')) {
        return Promise.resolve(new Response(JSON.stringify({ items: [], totalPages: 1 }), { status: 200 }));
      }

      if (url.includes('/api/collections/ai_usage_logs/records?')) {
        return Promise.resolve(new Response(JSON.stringify({ items: [], totalPages: 1 }), { status: 200 }));
      }

      if (url.endsWith('/chat/completions')) {
        const requestBody = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
          messages?: { content: string; role: string }[];
        };
        const userMessage = requestBody.messages?.find((message) => message.role === 'user');

        expect(userMessage?.content).toContain('"inputWeightGrams":200');
        expect(userMessage?.content).toContain('"samples"');
        expect(userMessage?.content).toContain('"model":"tank200d"');
        expect(userMessage?.content).toContain('"firstCrackTimeSeconds":430');
        expect(userMessage?.content).toContain('"totalTimeSeconds":540');

        return Promise.resolve(new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  confidence: 76,
                  issues: [
                    {
                      category: '发展期',
                      evidence: '一爆后升温率下降偏快，甜感可能偏薄。',
                      severity: 'medium',
                    },
                  ],
                  nextRoastAdjustments: ['下一炉一爆后减少降火幅度，让升温率缓慢下降。'],
                  primaryAdjustment: {
                    action: '一爆后减少降火幅度。',
                    area: 'development',
                    direction: 'increase',
                    rationale: '曲线显示一爆后能量衔接偏弱。',
                  },
                  summary: '结合原计划和实际曲线，本次一爆后能量衔接偏弱。',
                }),
              },
            },
          ],
        }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/ai_roast_reviews/records')) {
        expect(init?.method).toBe('POST');
        const payload = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
        expect(payload).toMatchObject({
          curve_record_id: 'curve-1',
          machine_id: 'machine-1',
          owner: 'user-1',
          roast_batch_id: 'batch-1',
        });
        return Promise.resolve(new Response(JSON.stringify({ id: 'review-1' }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/ai_usage_logs/records')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toMatchObject({
          feature: 'roast_analysis',
          owner: 'user-1',
          status: 'success',
        });
        return Promise.resolve(new Response(JSON.stringify({ id: 'usage-log-1' }), { status: 200 }));
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
      path: '/api/ai/roast-analysis',
    })).resolves.toMatchObject({
      body: {
        code: 0,
        data: {
          analysis: {
            confidence: 76,
            summary: '结合原计划和实际曲线，本次一爆后能量衔接偏弱。',
          },
          alreadyReviewed: false,
          reviewId: 'review-1',
        },
        message: 'ok',
      },
      status: 200,
    });
  });

  it('keeps AI roast plan recommendation working when optional machine memory queries fail', async () => {
    vi.stubEnv('EASYBAKE_APP_ENV', 'staging');
    vi.stubEnv('AI_ROAST_API_KEY', 'test-ai-key');
    vi.stubEnv('AI_ROAST_MODEL', 'gpt-5.5');
    vi.stubEnv('PB_SUPERUSER_EMAIL', 'admin@example.com');
    vi.stubEnv('PB_SUPERUSER_PASSWORD', 'admin-password');
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

      if (url.endsWith('/api/collections/_superusers/auth-with-password')) {
        return Promise.resolve(new Response(JSON.stringify({
          record: { email: 'admin@example.com', id: 'admin-1', verified: true },
          token: 'superuser-token',
        }), { status: 200 }));
      }

      if (url.includes('/api/collections/ai_usage_limits/records?')) {
        return Promise.resolve(new Response(JSON.stringify({ items: [], totalPages: 1 }), { status: 200 }));
      }

      if (url.includes('/api/collections/ai_usage_logs/records?')) {
        return Promise.resolve(new Response(JSON.stringify({ items: [], totalPages: 1 }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/green_beans/records/bean-1')) {
        return Promise.resolve(new Response(JSON.stringify({
          flavor_tags: ['花香', '柑橘'],
          id: 'bean-1',
          name: '测试生豆',
          process: '水洗',
        }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/roasting_machines/records/machine-1')) {
        return Promise.resolve(new Response(JSON.stringify({
          configuration: { controls: ['火力'] },
          display_name: 'tank200 · 顽固 TANK200D咖啡烘焙机',
          id: 'machine-1',
          model_key: 'tank200d',
        }), { status: 200 }));
      }

      if (
        url.includes('/api/collections/ai_roast_profiles/records?') ||
        url.includes('/api/collections/ai_roast_reviews/records?') ||
        url.includes('/api/collections/ai_roast_recommendations/records?')
      ) {
        return Promise.resolve(new Response(JSON.stringify({
          data: {},
          message: 'Something went wrong while processing your request.',
        }), { status: 500 }));
      }

      if (url.endsWith('/chat/completions')) {
        const requestBody = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
          messages?: { content: string; role: string }[];
        };
        const userMessage = requestBody.messages?.find((message) => message.role === 'user');

        expect(userMessage?.content).toContain('"recentReviews":[]');
        expect(userMessage?.content).toContain('"recentRecommendations":[]');

        return Promise.resolve(new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  adjustments: [
                    {
                      area: '机器响应',
                      expectedResult: '降低前段过冲风险，保留花香和酸质。',
                      observation: '当前没有可用历史机器画像，按保守起始方案设定。',
                      priority: 'medium',
                      rationale: 'Tank200D 只按火力做可执行调整。',
                      suggestion: '前段使用中高火，转黄后逐步收火，一爆后保持温和发展。',
                    },
                  ],
                  confidence: 70,
                  modifiedPlanJson: {
                    batchWeightGrams: 200,
                    beanId: 'bean-1',
                    beanName: '测试生豆',
                    name: 'AI 推荐计划',
                    purpose: '手冲',
                    roastLevel: '浅度烘焙',
                    roasterMachineId: 'machine-1',
                    roasterModel: 'tank200 · 顽固 TANK200D咖啡烘焙机',
                    steps: [
                      {
                        airTemperature: '不可调',
                        drumSpeed: '不可调',
                        event: '入豆',
                        firePower: '80%',
                        operation: '入豆',
                        temperature: '205°C',
                        time: '0:00',
                      },
                    ],
                  },
                  overallReview: '当前按生豆特征和机器可调火力生成保守起始计划。',
                }),
              },
            },
          ],
        }), { status: 200 }));
      }

      if (url.endsWith('/api/collections/ai_usage_logs/records')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toMatchObject({
          feature: 'roast_plan_recommendation',
          owner: 'user-1',
          status: 'success',
        });
        return Promise.resolve(new Response(JSON.stringify({ id: 'usage-log-1' }), { status: 200 }));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestGateway({
      body: JSON.stringify({
        batchWeightGrams: 200,
        beanId: 'bean-1',
        flavorExpectation: '优质花香、酸质、甜感，低烟感、苦度',
        planName: 'AI 推荐计划',
        purpose: '手冲',
        roastLevel: '浅度烘焙',
        roasterMachineId: 'machine-1',
      }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'easybake_pb_session=session-token',
      },
      method: 'POST',
      path: '/api/ai/roast-plan-recommendation',
    })).resolves.toMatchObject({
      body: {
        code: 0,
        data: {
          recommendation: {
            confidence: 70,
            modifiedPlanJson: {
              beanId: 'bean-1',
              name: 'AI 推荐计划',
              roasterMachineId: 'machine-1',
              steps: [
                {
                  airTemperature: '不可调',
                  drumSpeed: '不可调',
                  firePower: '80%',
                },
              ],
            },
          },
        },
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
