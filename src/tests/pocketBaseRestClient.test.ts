import { describe, expect, it, vi } from 'vitest';

import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';
import { pocketBaseSessionService } from '@/services/pocketBaseSession.service';

describe('PocketBaseRestClient', () => {
  it('falls back to the current origin when project url is omitted', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ id: 'bean-default', display_name: 'Default URL Bean' }]), {
          status: 200,
        }),
      ),
    );
    const client = new PocketBaseRestClient({
      fetcher,
      projectUrl: '',
      publishableKey: '',
    });

    await expect(client.list<{ display_name: string; id: string }>('green_beans')).resolves.toEqual([
      { id: 'bean-default', display_name: 'Default URL Bean' },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining(`${window.location.origin}/api/collections/green_beans/records`),
      expect.objectContaining({
        credentials: 'same-origin',
        method: 'GET',
      }),
    );
  });

  it('uses the same-origin BFF without forwarding a token for primary business requests', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ id: 'bean-gateway', display_name: 'Gateway Bean' }]), {
          status: 200,
        }),
      ),
    );
    const client = new PocketBaseRestClient({
      fetcher,
      projectUrl: 'https://external-pocketbase.example.com',
      publishableKey: '',
    });

    await client.list('green_beans');

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining(`${window.location.origin}/api/collections/green_beans/records`),
      expect.objectContaining({
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      }),
    );
  });

  it('maps auth failures to AppError', async () => {
    const client = new PocketBaseRestClient({
      fetcher: () =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Invalid API key' }), {
            status: 401,
          }),
        ),
      projectUrl: 'http://81.70.224.75',
      publishableKey: '',
    });

    await expect(client.list('green_bean_inventory_overview')).rejects.toMatchObject({
      code: 'AUTH',
      status: 401,
    });
  });

  it('maps timeout aborts to AppError', async () => {
    const client = new PocketBaseRestClient({
      fetcher: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
      projectUrl: 'http://81.70.224.75',
      publishableKey: '',
      timeoutMs: 5,
    });

    await expect(client.list('green_bean_inventory_overview')).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('returns list payloads when PocketBase responds with array data', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ id: 'bean-1', display_name: 'Guji' }]), {
          status: 200,
        }),
      ),
    );
    const client = new PocketBaseRestClient({
      fetcher,
      projectUrl: 'http://81.70.224.75',
      publishableKey: '',
    });

    await expect(client.list<{ display_name: string; id: string }>('green_bean_inventory_overview')).resolves
      .toEqual([{ id: 'bean-1', display_name: 'Guji' }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('allows requests when pocketbase url is configured but publishable key is empty', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ id: 'bean-2', display_name: 'Yirgacheffe' }]), {
          status: 200,
        }),
      ),
    );
    const client = new PocketBaseRestClient({
      fetcher,
      projectUrl: 'http://81.70.224.75',
      publishableKey: '',
    });

    await expect(client.list<{ display_name: string; id: string }>('green_beans')).resolves.toEqual([
      { id: 'bean-2', display_name: 'Yirgacheffe' },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('surfaces detailed PocketBase validation errors for failed inserts', async () => {
    const client = new PocketBaseRestClient({
      fetcher: () =>
        Promise.resolve(
          new Response(JSON.stringify({
            data: {
              planned_batch_kg: {
                code: 'validation_required',
                message: 'Missing required value.',
              },
              steps: {
                code: 'validation_invalid_value',
                message: 'Invalid value.',
              },
            },
            message: 'Failed to create record.',
          }), {
            status: 400,
          }),
        ),
      projectUrl: 'http://81.70.224.75',
      publishableKey: '',
    });

    await expect(client.insert('roast_profiles', { name: 'Test' })).rejects.toMatchObject({
      code: 'HTTP',
      message: '提交失败：计划批量不能为空；烘焙节点格式无效',
      status: 400,
    });
  });

  it('translates PocketBase minimum number validation messages', async () => {
    const client = new PocketBaseRestClient({
      fetcher: () =>
        Promise.resolve(
          new Response(JSON.stringify({
            data: {
              planned_batch_kg: {
                code: 'validation_invalid_value',
                message: 'Must be greater or equal than 1.',
              },
            },
            message: 'Failed to create record.',
          }), {
            status: 400,
          }),
        ),
      projectUrl: 'http://81.70.224.75',
      publishableKey: '',
    });

    await expect(client.insert('roast_profiles', { name: 'Test' })).rejects.toMatchObject({
      code: 'HTTP',
      message: '提交失败：计划批量不能小于 1',
      status: 400,
    });
  });

  it('translates generic PocketBase processing failures before showing them to users', async () => {
    const client = new PocketBaseRestClient({
      fetcher: () =>
        Promise.resolve(
          new Response(JSON.stringify({
            message: 'Something went wrong while processing your request.',
          }), {
            status: 400,
          }),
        ),
      projectUrl: 'http://81.70.224.75',
      publishableKey: '',
    });

    await expect(client.list('green_beans')).rejects.toMatchObject({
      code: 'HTTP',
      message: 'PocketBase 请求失败，请稍后重试或联系管理员检查服务日志。（HTTP 400）',
      status: 400,
    });
  });

  it('can delegate public collection access rules to PocketBase without an owner filter', async () => {
    pocketBaseSessionService.save({
      user: { email: 'roaster@example.com', id: 'roaster-user' },
    });
    let requestUrl = '';
    const requestBodies: string[] = [];
    const client = new PocketBaseRestClient({
      autoManageOwner: false,
      autoManageTimestamps: false,
      fetcher: (input, init) => {
        requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (typeof init?.body === 'string') {
          requestBodies.push(init.body);
        }
        return Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }));
      },
      projectUrl: 'http://81.70.224.75',
    });

    await client.list('roaster_models', { orderBy: { column: 'model_name' } });

    expect(requestUrl).toContain('sort=model_name');
    expect(requestUrl).not.toContain('owner');

    await client.insert('roaster_models', { created_by: 'roaster-user', model_name: 'Tank200D' });

    expect(requestBodies).toEqual(['{"created_by":"roaster-user","model_name":"Tank200D"}']);
    pocketBaseSessionService.clear();
  });
});
