import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserDataCleanupService } from '@/shared/services/browserDataCleanup.service';

describe('browserDataCleanupService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('clears all current-origin browser data after an authentication boundary', async () => {
    const cacheDelete = vi.fn().mockResolvedValue(true);
    const indexedDbDelete = vi.fn(() => {
      const request = new EventTarget();

      queueMicrotask(() => request.dispatchEvent(new Event('success')));

      return request as unknown as IDBOpenDBRequest;
    });

    vi.stubGlobal('caches', {
      delete: cacheDelete,
      keys: vi.fn().mockResolvedValue(['easybake-api-cache']),
    } satisfies Partial<CacheStorage>);
    vi.stubGlobal('indexedDB', {
      databases: vi.fn().mockResolvedValue([{ name: 'easybake-offline' }]),
      deleteDatabase: indexedDbDelete,
    } satisfies Partial<IDBFactory>);

    window.localStorage.setItem('coffee-roasting-backstage:account', 'sensitive');
    window.localStorage.setItem('other-current-origin-data', 'clear');
    window.sessionStorage.setItem('current-session-state', 'clear');
    document.cookie = 'easybake-preference=enabled; Path=/';

    await browserDataCleanupService.clearCurrentOriginData();

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain('easybake-preference=enabled');
    expect(cacheDelete).toHaveBeenCalledWith('easybake-api-cache');
    expect(indexedDbDelete).toHaveBeenCalledWith('easybake-offline');
  });
});
