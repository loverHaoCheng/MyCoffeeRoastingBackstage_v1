import { describe, expect, it } from 'vitest';

import { seedBeans } from '@/modules/bean/constants';
import { beanCacheService } from '@/modules/bean/services';

describe('beanCacheService', () => {
  it('keeps bean cache in runtime memory and returns status metadata', () => {
    beanCacheService.clear();

    beanCacheService.save(seedBeans, 'mock');

    expect(beanCacheService.getBeans()).toHaveLength(seedBeans.length);
    expect(beanCacheService.getStatus()).toMatchObject({
      recordCount: seedBeans.length,
      source: 'mock',
      status: 'cached',
    });
  });

  it('marks fallback without losing the cached beans', () => {
    beanCacheService.clear();
    beanCacheService.save(seedBeans.slice(0, 2), 'supabase');

    const cachedBeans = beanCacheService.markFallback('TIMEOUT');

    expect(cachedBeans).toHaveLength(2);
    expect(beanCacheService.getStatus()).toMatchObject({
      errorCode: 'TIMEOUT',
      recordCount: 2,
      source: 'supabase',
      status: 'fallback',
    });
  });

  it('stores a sync error even when there is no cached bean data', () => {
    beanCacheService.clear();

    beanCacheService.markFailure('NETWORK');

    expect(beanCacheService.getStatus()).toMatchObject({
      errorCode: 'NETWORK',
      recordCount: 0,
      source: 'supabase',
      status: 'error',
      syncedAt: null,
    });
  });
});
