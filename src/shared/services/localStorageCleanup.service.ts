const APP_STORAGE_PREFIX = 'coffee-roasting-backstage:';

const activeStorageKeys = new Set<string>([
  'coffee-roasting-backstage:app-display-settings',
  'coffee-roasting-backstage:beans-cache',
  'coffee-roasting-backstage:cost-calculations',
  'coffee-roasting-backstage:cost-templates',
  'coffee-roasting-backstage:last-seen-build-version',
  'coffee-roasting-backstage:local-green-beans',
  'coffee-roasting-backstage:pending-ops',
  'coffee-roasting-backstage:roast-batches',
  'coffee-roasting-backstage:roast-plans',
  'coffee-roasting-backstage:supabase-connections',
]);

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export const localStorageCleanupService = {
  cleanupObsoleteKeys(): string[] {
    if (!canUseStorage()) {
      return [];
    }

    const removedKeys: string[] = [];
    const keysToRemove: string[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (!key || !key.startsWith(APP_STORAGE_PREFIX)) {
        continue;
      }

      if (activeStorageKeys.has(key)) {
        continue;
      }

      keysToRemove.push(key);
    }

    keysToRemove.forEach((key) => {
      window.localStorage.removeItem(key);
      removedKeys.push(key);
    });

    return removedKeys;
  },
};
