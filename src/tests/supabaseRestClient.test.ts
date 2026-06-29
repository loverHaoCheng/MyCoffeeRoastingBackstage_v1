import { describe, expect, it, vi } from 'vitest';

import { SupabaseRestClient } from '@/services/supabaseRestClient';

describe('SupabaseRestClient', () => {
  it('throws config error when project url or key is missing', async () => {
    const client = new SupabaseRestClient({
      projectUrl: '',
      publishableKey: '',
    });

    await expect(client.list('green_bean_inventory_overview')).rejects.toMatchObject({
      code: 'CONFIG',
    });
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
});
