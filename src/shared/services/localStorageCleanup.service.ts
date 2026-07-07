const APP_STORAGE_PREFIX = 'coffee-roasting-backstage:';

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const collectAppStorageKeys = (): string[] => {
  const keys: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith(APP_STORAGE_PREFIX)) {
      keys.push(key);
    }
  }

  return keys;
};

export const localStorageCleanupService = {
  clearAppState(): string[] {
    if (!canUseStorage()) {
      return [];
    }

    const removedKeys: string[] = [];

    collectAppStorageKeys().forEach((key) => {
      window.localStorage.removeItem(key);
      removedKeys.push(key);
    });

    return removedKeys;
  },
  cleanupObsoleteKeys(): string[] {
    return this.clearAppState();
  },
};
