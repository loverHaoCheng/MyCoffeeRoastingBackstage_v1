import { describe, expect, it, vi } from 'vitest';

import { SupabaseRestClient } from '@/services/supabaseRestClient';

describe('SupabaseRestClient', () => {
  it('falls back to the default pocketbase url when project url is omitted', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ id: 'bean-default', display_name: 'Default URL Bean' }]), {
          status: 200,
        }),
      ),
    );
    const client = new SupabaseRestClient({
      fetcher,
      projectUrl: '',
      publishableKey: '',
    });

    await expect(client.list<{ display_name: string; id: string }>('green_beans')).resolves.toEqual([
      { id: 'bean-default', display_name: 'Default URL Bean' },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('http://81.70.224.75/api/collections/green_beans/records'),
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('maps auth failures to AppError', async () => {
    const client = new SupabaseRestClient({
      fetcher: () =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Invalid API key' }), {
            status: 401,
          }),
        ),
      projectUrl: 'https://demo.supabase.co',
      publishableKey: 'sb_publishable_demo',
    });

    await expect(client.list('green_bean_inventory_overview')).rejects.toMatchObject({
      code: 'AUTH',
      status: 401,
    });
  });

  it('maps timeout aborts to AppError', async () => {
    const client = new SupabaseRestClient({
      fetcher: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
      projectUrl: 'https://demo.supabase.co',
      publishableKey: 'sb_publishable_demo',
      timeoutMs: 5,
    });

    await expect(client.list('green_bean_inventory_overview')).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('returns list payloads when Supabase responds with array data', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ id: 'bean-1', display_name: 'Guji' }]), {
          status: 200,
        }),
      ),
    );
    const client = new SupabaseRestClient({
      fetcher,
      projectUrl: 'https://demo.supabase.co',
      publishableKey: 'sb_publishable_demo',
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
    const client = new SupabaseRestClient({
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
    const client = new SupabaseRestClient({
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
    const client = new SupabaseRestClient({
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
});
