interface IndexedDbFactoryWithDatabaseListing {
  databases?: () => Promise<readonly IDBDatabaseInfo[]>;
  deleteDatabase: IDBFactory['deleteDatabase'];
}

const canUseBrowser = (): boolean => typeof window !== 'undefined';

const clearStorage = (storage: Storage): void => {
  try {
    storage.clear();
  } catch {
    // Storage access can be disabled by browser privacy settings.
  }
};

const clearAccessibleCookies = (): void => {
  const cookieNames = document.cookie
    .split(';')
    .map((entry) => entry.trim().split('=', 1)[0] ?? '')
    .filter((name) => name.length > 0);

  cookieNames.forEach((name) => {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  });
};

const clearCacheStorage = async (): Promise<void> => {
  if (!('caches' in window)) {
    return;
  }

  const cacheNames = await window.caches.keys();

  await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
};

const clearIndexedDb = async (): Promise<void> => {
  if (!('indexedDB' in window)) {
    return;
  }

  const indexedDb = window.indexedDB as unknown as IndexedDbFactoryWithDatabaseListing;

  if (!indexedDb.databases) {
    return;
  }

  const databases = await indexedDb.databases();

  await Promise.all(
    databases
      .map((database) => database.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0)
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDb.deleteDatabase(name);

            request.addEventListener('error', () => {
              resolve();
            }, { once: true });
            request.addEventListener('success', () => {
              resolve();
            }, { once: true });
          }),
      ),
  );
};

export const browserDataCleanupService = {
  async clearCurrentOriginData(): Promise<void> {
    if (!canUseBrowser()) {
      return;
    }

    clearStorage(window.localStorage);
    clearStorage(window.sessionStorage);
    clearAccessibleCookies();

    await Promise.allSettled([clearCacheStorage(), clearIndexedDb()]);
  },
};
