import type { CacheEntry, CacheNamespace, CacheRepository, CacheSetOptions } from './cache.types';

const DATABASE_NAME = 'coffee-roasting-backstage-cache';
const DATABASE_VERSION = 1;
const ENTRY_STORE_NAME = 'entries';

const isExpired = (entry: CacheEntry): boolean => {
  return entry.expiresAt != null && new Date(entry.expiresAt).getTime() <= Date.now();
};

const createEntryId = (namespace: CacheNamespace, key: string): string => {
  return `${namespace}:${key}`;
};

const canUseIndexedDb = (): boolean => {
  return typeof indexedDB !== 'undefined';
};

const requestToPromise = <TValue>(request: IDBRequest<TValue>): Promise<TValue> => {
  return new Promise<TValue>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    };
  });
};

const openDatabase = async (): Promise<IDBDatabase | null> => {
  if (!canUseIndexedDb()) {
    return null;
  }

  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

  request.onupgradeneeded = () => {
    const database = request.result;

    if (!database.objectStoreNames.contains(ENTRY_STORE_NAME)) {
      const store = database.createObjectStore(ENTRY_STORE_NAME, { keyPath: 'id' });
      store.createIndex('namespace', 'namespace', { unique: false });
    }
  };

  return requestToPromise(request);
};

const runTransaction = async <TValue>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<TValue> | Promise<TValue> | TValue,
): Promise<TValue | null> => {
  const database = await openDatabase();

  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(ENTRY_STORE_NAME, mode);
    const store = transaction.objectStore(ENTRY_STORE_NAME);
    const result = callback(store);

    return result instanceof IDBRequest ? await requestToPromise(result) : await result;
  } finally {
    database.close();
  }
};

const removeExpiredEntry = async (entry: CacheEntry): Promise<void> => {
  await runTransaction('readwrite', (store) => store.delete(createEntryId(entry.namespace, entry.key)));
};

export const indexedDbCacheRepository: CacheRepository = {
  async clearNamespace(namespace) {
    const entries = await this.list(namespace);

    await Promise.all(entries.map((entry) => this.delete(entry.namespace, entry.key)));
  },
  async delete(namespace, key) {
    await runTransaction('readwrite', (store) => store.delete(createEntryId(namespace, key)));
  },
  async get<TValue>(namespace: CacheNamespace, key: string): Promise<CacheEntry<TValue> | null> {
    const result = await runTransaction<CacheEntry<TValue> | undefined>('readonly', (store) =>
      store.get(createEntryId(namespace, key)),
    );
    const entry = result ?? null;

    if (!entry) {
      return null;
    }

    if (isExpired(entry)) {
      await removeExpiredEntry(entry);
      return null;
    }

    return entry;
  },
  async list<TValue>(namespace: CacheNamespace): Promise<CacheEntry<TValue>[]> {
    const result = await runTransaction<CacheEntry<TValue>[]>('readonly', (store) => {
      const index = store.index('namespace');

      return index.getAll(namespace);
    });
    const entries = result ?? [];
    const activeEntries = entries.filter((entry) => !isExpired(entry));
    const expiredEntries = entries.filter(isExpired);

    if (expiredEntries.length > 0) {
      await Promise.all(expiredEntries.map(removeExpiredEntry));
    }

    return activeEntries;
  },
  async set<TValue>(
    namespace: CacheNamespace,
    key: string,
    value: TValue,
    options: CacheSetOptions,
  ): Promise<CacheEntry<TValue>> {
    const entry: CacheEntry<TValue> & { id: string } = {
      expiresAt: options.expiresAt ?? null,
      id: createEntryId(namespace, key),
      key,
      namespace,
      schemaVersion: options.schemaVersion,
      updatedAt: new Date().toISOString(),
      value,
    };

    await runTransaction('readwrite', (store) => store.put(entry));

    return entry;
  },
};
