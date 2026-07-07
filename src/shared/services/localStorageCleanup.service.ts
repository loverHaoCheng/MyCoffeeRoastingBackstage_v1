const APP_STORAGE_PREFIX = 'coffee-roasting-backstage:';
const POCKETBASE_CONNECTION_SETTINGS_KEY = 'coffee-roasting-backstage:pocketbase-connections';
const LEGACY_SUPABASE_CONNECTION_SETTINGS_KEY = 'coffee-roasting-backstage:supabase-connections';
const preservedStorageKeys = new Set<string>([
  'coffee-roasting-backstage:app-display-settings',
  POCKETBASE_CONNECTION_SETTINGS_KEY,
  LEGACY_SUPABASE_CONNECTION_SETTINGS_KEY,
]);

const activeStorageKeys = new Set<string>([
  'coffee-roasting-backstage:app-display-settings',
  'coffee-roasting-backstage:beans-cache',
  'coffee-roasting-backstage:cost-calculations',
  'coffee-roasting-backstage:cost-templates',
  'coffee-roasting-backstage:last-seen-build-version',
  'coffee-roasting-backstage:local-green-beans',
  'coffee-roasting-backstage:pending-ops',
  'coffee-roasting-backstage:pocketbase-session',
  'coffee-roasting-backstage:roast-batches',
  'coffee-roasting-backstage:roast-plans',
  POCKETBASE_CONNECTION_SETTINGS_KEY,
  LEGACY_SUPABASE_CONNECTION_SETTINGS_KEY,
]);

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export const localStorageCleanupService = {
  clearAppState(): string[] {
    if (!canUseStorage()) {
      return [];
    }

    const removedKeys: string[] = [];

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);

      if (!key?.startsWith(APP_STORAGE_PREFIX)) {
        continue;
      }

      if (preservedStorageKeys.has(key)) {
        continue;
      }

      window.localStorage.removeItem(key);
      removedKeys.push(key);
    }

    return removedKeys;
  },
  cleanupObsoleteKeys(): string[] {
    if (!canUseStorage()) {
      return [];
    }

    const removedKeys: string[] = [];
    const keysToRemove: string[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (!key?.startsWith(APP_STORAGE_PREFIX)) {
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
