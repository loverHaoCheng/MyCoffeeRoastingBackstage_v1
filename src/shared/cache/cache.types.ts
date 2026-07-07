export interface CacheEntry<TValue = unknown> {
  expiresAt: null | string;
  key: string;
  namespace: CacheNamespace;
  schemaVersion: number;
  updatedAt: string;
  value: TValue;
}

export type CacheNamespace =
  | 'app-settings'
  | 'bean'
  | 'finance'
  | 'personal-backup'
  | 'production'
  | 'roast'
  | 'sync-queue';

export interface CacheSetOptions {
  expiresAt?: null | string;
  schemaVersion: number;
}

export interface CacheRepository {
  clearNamespace(namespace: CacheNamespace): Promise<void>;
  delete(namespace: CacheNamespace, key: string): Promise<void>;
  get<TValue>(namespace: CacheNamespace, key: string): Promise<CacheEntry<TValue> | null>;
  list<TValue>(namespace: CacheNamespace): Promise<CacheEntry<TValue>[]>;
  set<TValue>(
    namespace: CacheNamespace,
    key: string,
    value: TValue,
    options: CacheSetOptions,
  ): Promise<CacheEntry<TValue>>;
}
