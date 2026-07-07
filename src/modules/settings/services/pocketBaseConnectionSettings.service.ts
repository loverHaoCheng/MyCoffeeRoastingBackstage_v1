import { pocketBaseConnectionSettingsStorageSchema } from '@/modules/settings/schemas';
import {
  createDefaultPocketBaseConnectionSettings,
  normalizePocketBaseProjectConnection,
  type PocketBaseConnectionSettings,
  type PocketBaseDataSource,
  type PocketBaseProjectConnection,
} from '@/modules/settings/types';
import { logger } from '@/shared/logger/logger';

export const pocketBaseConnectionSettingsStorageKey =
  'coffee-roasting-backstage:pocketbase-connections';
const legacyPocketBaseConnectionSettingsStorageKey =
  'coffee-roasting-backstage:supabase-connections';
const pocketBaseConnectionSettingsBackupStorageKey =
  'coffee-roasting-backstage:pocketbase-connections:backup';
const legacyPocketBaseConnectionSettingsBackupStorageKey =
  'coffee-roasting-backstage:supabase-connections:backup';

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export const pocketBaseConnectionSettingsService = {
  clear(): void {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(pocketBaseConnectionSettingsStorageKey);
    window.localStorage.removeItem(legacyPocketBaseConnectionSettingsStorageKey);
    window.localStorage.removeItem(pocketBaseConnectionSettingsBackupStorageKey);
    window.localStorage.removeItem(legacyPocketBaseConnectionSettingsBackupStorageKey);
  },
  load(): PocketBaseConnectionSettings {
    if (!canUseStorage()) {
      return createDefaultPocketBaseConnectionSettings();
    }

    const rawValue =
      window.localStorage.getItem(pocketBaseConnectionSettingsStorageKey) ??
      window.localStorage.getItem(legacyPocketBaseConnectionSettingsStorageKey);

    if (!rawValue) {
      window.localStorage.removeItem(legacyPocketBaseConnectionSettingsBackupStorageKey);
      return createDefaultPocketBaseConnectionSettings();
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;
      const result = pocketBaseConnectionSettingsStorageSchema.safeParse(parsed);

      if (!result.success) {
        logger.warn('pocketbase connection settings parse failed', {
          issues: result.error.issues,
        });
        return createDefaultPocketBaseConnectionSettings();
      }

      if (!window.localStorage.getItem(pocketBaseConnectionSettingsStorageKey)) {
        window.localStorage.setItem(pocketBaseConnectionSettingsStorageKey, rawValue);
      }
      window.localStorage.removeItem(legacyPocketBaseConnectionSettingsStorageKey);
      window.localStorage.removeItem(legacyPocketBaseConnectionSettingsBackupStorageKey);

      const normalizedSettings: PocketBaseConnectionSettings = {
        greenBean: normalizePocketBaseProjectConnection(result.data.greenBean),
        roastedBean: normalizePocketBaseProjectConnection(result.data.roastedBean, {
          fallbackToDefaultUrl: false,
        }),
        updatedAt: result.data.updatedAt ?? null,
      };

      if (JSON.stringify(normalizedSettings) !== rawValue) {
        window.localStorage.setItem(
          pocketBaseConnectionSettingsStorageKey,
          JSON.stringify(normalizedSettings),
        );
      }

      return normalizedSettings;
    } catch (error) {
      logger.error('pocketbase connection settings load failed', { error });
      return createDefaultPocketBaseConnectionSettings();
    }
  },
  resolveProjectConnection(dataSource: PocketBaseDataSource): PocketBaseProjectConnection {
    return this.load()[dataSource];
  },
  save(settings: PocketBaseConnectionSettings): PocketBaseConnectionSettings {
    if (!canUseStorage()) {
      return settings;
    }

    const normalizedSettings: PocketBaseConnectionSettings = {
      greenBean: normalizePocketBaseProjectConnection(settings.greenBean),
      roastedBean: normalizePocketBaseProjectConnection(settings.roastedBean, {
        fallbackToDefaultUrl: false,
      }),
      updatedAt: settings.updatedAt,
    };
    const serialized = JSON.stringify(normalizedSettings);

    window.localStorage.setItem(pocketBaseConnectionSettingsStorageKey, serialized);
    window.localStorage.removeItem(legacyPocketBaseConnectionSettingsStorageKey);
    window.localStorage.removeItem(pocketBaseConnectionSettingsBackupStorageKey);
    window.localStorage.removeItem(legacyPocketBaseConnectionSettingsBackupStorageKey);
    logger.info('pocketbase connection settings saved', {
      updatedAt: normalizedSettings.updatedAt,
    });

    return normalizedSettings;
  },
};
