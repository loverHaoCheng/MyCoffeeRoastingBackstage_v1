import { pocketBaseConnectionSettingsStorageSchema } from '@/modules/settings/schemas';
import {
  createDefaultPocketBaseConnectionSettings,
  normalizePocketBaseProjectConnection,
  normalizeRoastedBeanPocketBaseProjectConnection,
  type PocketBaseConnectionSettings,
  type PocketBaseDataSource,
  type PocketBaseProjectConnection,
} from '@/modules/settings/types';
import { logger } from '@/shared/logger/logger';

export const pocketBaseConnectionSettingsStorageKey =
  'coffee-roasting-backstage:pocketbase-connections';

let currentPocketBaseConnectionSettings: PocketBaseConnectionSettings =
  createDefaultPocketBaseConnectionSettings();

export const pocketBaseConnectionSettingsService = {
  clear(): void {
    currentPocketBaseConnectionSettings = createDefaultPocketBaseConnectionSettings();
  },
  load(): PocketBaseConnectionSettings {
    const result = pocketBaseConnectionSettingsStorageSchema.safeParse(currentPocketBaseConnectionSettings);

    if (!result.success) {
      logger.warn('pocketbase connection settings memory state parse failed', {
        issues: result.error.issues,
      });
      currentPocketBaseConnectionSettings = createDefaultPocketBaseConnectionSettings();
      return createDefaultPocketBaseConnectionSettings();
    }

    return {
      greenBean: normalizePocketBaseProjectConnection(result.data.greenBean),
      roastedBean: normalizeRoastedBeanPocketBaseProjectConnection(result.data.roastedBean),
      updatedAt: result.data.updatedAt ?? null,
    };
  },
  resolveProjectConnection(dataSource: PocketBaseDataSource): PocketBaseProjectConnection {
    return this.load()[dataSource];
  },
  save(settings: PocketBaseConnectionSettings): PocketBaseConnectionSettings {
    const normalizedSettings: PocketBaseConnectionSettings = {
      greenBean: normalizePocketBaseProjectConnection(settings.greenBean),
      roastedBean: normalizeRoastedBeanPocketBaseProjectConnection(settings.roastedBean),
      updatedAt: settings.updatedAt,
    };

    currentPocketBaseConnectionSettings = normalizedSettings;
    logger.info('pocketbase connection settings saved', {
      updatedAt: normalizedSettings.updatedAt,
    });

    return normalizedSettings;
  },
};
