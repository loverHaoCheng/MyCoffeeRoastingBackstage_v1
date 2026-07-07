import { describe, expect, it, vi } from 'vitest';

import { SupabaseDataClient } from '@/services/supabaseDataClient';

describe('SupabaseDataClient', () => {
  it('uses supabase rest endpoints with anon key headers', async () => {
    let capturedInput: RequestInfo | URL | undefined;
    let capturedRequestInit: RequestInit | undefined;

    const fetcher = vi.fn<typeof fetch>((input, init) => {
      capturedInput = input;
      capturedRequestInit = init;

      return Promise.resolve(
        new Response(JSON.stringify([{ id: 'bean-1' }]), {
          status: 200,
        }),
      );
    });
    const client = new SupabaseDataClient({
      fetcher,
      projectUrl: 'https://demo.supabase.co/',
      publishableKey: 'sb_publishable_demo',
    });

    await expect(client.list<{ id: string }>('coffee_beans', {
      limit: 1,
      select: 'id',
    })).resolves.toEqual([{ id: 'bean-1' }]);

    expect(capturedInput).toBe('https://demo.supabase.co/rest/v1/coffee_beans?select=id&limit=1');
    expect(capturedRequestInit?.method).toBe('GET');

    if (!(capturedRequestInit?.headers instanceof Headers)) {
      throw new Error('Supabase request headers were not captured');
    }

    expect(capturedRequestInit.headers.get('apikey')).toBe('sb_publishable_demo');
    expect(capturedRequestInit.headers.get('Authorization')).toBe('Bearer sb_publishable_demo');
  });
});
