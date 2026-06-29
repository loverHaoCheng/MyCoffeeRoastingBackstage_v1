import { describe, expect, it } from 'vitest';

import { seedBeans } from '@/modules/bean/constants';
import { beanCacheService, beanCacheStorageKey } from '@/modules/bean/services';

describe('beanCacheService', () => {
  it('persists bean cache to localStorage and returns status metadata', () => {
    window.localStorage.clear();

    beanCacheService.save(seedBeans, 'mock');

    const rawValue = window.localStorage.getItem(beanCacheStorageKey);

    expect(rawValue).not.toBeNull();
    expect(beanCacheService.getBeans()).toHaveLength(seedBeans.length);
    expect(beanCacheService.getStatus()).toMatchObject({
      recordCount: seedBeans.length,
      source: 'mock',
      status: 'cached',
    });
  });

  it('marks fallback without losing the cached beans', () => {
    window.localStorage.clear();
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
    window.localStorage.clear();

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
