// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import { reserveAiUsage } from './usage-service.js';

describe('AI usage reservations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows only one concurrent reservation when one use remains', async () => {
    const successfulLogIds: string[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/easybake/ai-usage/reserve')) {
        expect(init?.method).toBe('POST');
        if (successfulLogIds.length > 0) {
          return Promise.resolve(new Response(JSON.stringify({ message: '本月 AI 使用次数已用完。' }), { status: 429 }));
        }
        const logId = `usage-${String(successfulLogIds.length + 1)}`;
        successfulLogIds.push(logId);
        return Promise.resolve(new Response(JSON.stringify({
          logId,
          monthlyLimit: 1,
          remainingUses: 0,
          usedThisMonth: 1,
        }), { status: 201 }));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.allSettled([
      reserveAiUsage('superuser-token', 'user-1', 'roast_analysis', '2026-07'),
      reserveAiUsage('superuser-token', 'user-1', 'roast_analysis', '2026-07'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(successfulLogIds).toHaveLength(1);
  });
});
