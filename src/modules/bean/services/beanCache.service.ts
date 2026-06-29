import type { Bean } from '@/types/domain';

type BeanCacheSource = 'mock' | 'supabase';
type BeanCacheStatusType = 'cached' | 'empty' | 'error' | 'fallback' | 'idle';

interface BeanCacheSnapshot {
  beans: Bean[];
  errorCode: null | string;
  lastReadAt: null | string;
  source: BeanCacheSource;
  status: Exclude<BeanCacheStatusType, 'idle'>;
  syncedAt: null | string;
  version: 1;
}

export interface BeanCacheStatus {
  errorCode: null | string;
  lastReadAt: null | string;
  recordCount: number;
  source: BeanCacheSource | null;
  status: BeanCacheStatusType;
  syncedAt: null | string;
}

const BEAN_CACHE_VERSION = 1;
export const beanCacheStorageKey = 'coffee-roasting-backstage:beans-cache';
export const beanCacheUpdatedEventName = 'coffee-roasting-backstage:beans-cache-updated';

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const isBeanLike = (value: unknown): value is Bean => {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const bean = value as Partial<Bean>;

  return (
    (typeof bean.id === 'number' || typeof bean.id === 'string') &&
    typeof bean.name === 'string' &&
    typeof bean.origin === 'string' &&
    typeof bean.process === 'string' &&
    typeof bean.grade === 'string' &&
    typeof bean.stockKg === 'number' &&
    typeof bean.costPerKg === 'number' &&
    typeof bean.createdAt === 'string' &&
    typeof bean.updatedAt === 'string'
  );
};

const isBeanCacheSnapshot = (value: unknown): value is BeanCacheSnapshot => {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const snapshot = value as Partial<BeanCacheSnapshot>;

  return (
    snapshot.version === BEAN_CACHE_VERSION &&
    Array.isArray(snapshot.beans) &&
    snapshot.beans.every(isBeanLike) &&
    (snapshot.source === 'mock' || snapshot.source === 'supabase') &&
    (snapshot.status === 'cached' ||
      snapshot.status === 'empty' ||
      snapshot.status === 'error' ||
      snapshot.status === 'fallback') &&
    (snapshot.syncedAt == null || typeof snapshot.syncedAt === 'string') &&
    (snapshot.lastReadAt == null || typeof snapshot.lastReadAt === 'string') &&
    (snapshot.errorCode == null || typeof snapshot.errorCode === 'string')
  );
};

const emitUpdate = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(beanCacheUpdatedEventName));
};

const loadSnapshot = (): BeanCacheSnapshot | null => {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(beanCacheStorageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isBeanCacheSnapshot(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const saveSnapshot = (snapshot: BeanCacheSnapshot): void => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(beanCacheStorageKey, JSON.stringify(snapshot));
  emitUpdate();
};

export const beanCacheService = {
  clear(): void {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(beanCacheStorageKey);
    emitUpdate();
  },
  getBeans(): Bean[] | null {
    return loadSnapshot()?.beans ?? null;
  },
  getStatus(): BeanCacheStatus {
    const snapshot = loadSnapshot();

    if (!snapshot) {
      return {
        errorCode: null,
        lastReadAt: null,
        recordCount: 0,
        source: null,
        status: 'idle',
        syncedAt: null,
      };
    }

    return {
      errorCode: snapshot.errorCode,
      lastReadAt: snapshot.lastReadAt,
      recordCount: snapshot.beans.length,
      source: snapshot.source,
      status: snapshot.status,
      syncedAt: snapshot.syncedAt,
    };
  },
  markFallback(errorCode: string): Bean[] | null {
    const snapshot = loadSnapshot();

    if (!snapshot || snapshot.beans.length === 0) {
      return null;
    }

    saveSnapshot({
      ...snapshot,
      errorCode,
      lastReadAt: new Date().toISOString(),
      status: 'fallback',
    });

    return snapshot.beans;
  },
  markFailure(errorCode: string, source: BeanCacheSource = 'supabase'): void {
    const snapshot = loadSnapshot();

    saveSnapshot({
      beans: snapshot?.beans ?? [],
      errorCode,
      lastReadAt: new Date().toISOString(),
      source: snapshot?.source ?? source,
      status: snapshot && snapshot.beans.length > 0 ? 'fallback' : 'error',
      syncedAt: snapshot?.syncedAt ?? null,
      version: BEAN_CACHE_VERSION,
    });
  },
  save(beans: Bean[], source: BeanCacheSource): void {
    saveSnapshot({
      beans,
      errorCode: null,
      lastReadAt: new Date().toISOString(),
      source,
      status: beans.length > 0 ? 'cached' : 'empty',
      syncedAt: new Date().toISOString(),
      version: BEAN_CACHE_VERSION,
    });
  },
};
