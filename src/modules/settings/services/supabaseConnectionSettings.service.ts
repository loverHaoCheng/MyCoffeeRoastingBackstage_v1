import { supabaseConnectionSettingsStorageSchema } from '@/modules/settings/schemas';
import {
  createDefaultSupabaseConnectionSettings,
  type SupabaseConnectionSettings,
  type SupabaseDataSource,
  type SupabaseProjectConnection,
} from '@/modules/settings/types';
import { logger } from '@/shared/logger/logger';

export const supabaseConnectionSettingsStorageKey =
  'coffee-roasting-backstage:supabase-connections';
const legacySupabaseConnectionSettingsBackupStorageKey =
  'coffee-roasting-backstage:supabase-connections:backup';

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export const supabaseConnectionSettingsService = {
  clear(): void {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(supabaseConnectionSettingsStorageKey);
    window.localStorage.removeItem(legacySupabaseConnectionSettingsBackupStorageKey);
  },
  load(): SupabaseConnectionSettings {
    if (!canUseStorage()) {
      return createDefaultSupabaseConnectionSettings();
    }

    const rawValue = window.localStorage.getItem(supabaseConnectionSettingsStorageKey);

    if (!rawValue) {
      window.localStorage.removeItem(legacySupabaseConnectionSettingsBackupStorageKey);
      return createDefaultSupabaseConnectionSettings();
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;
      const result = supabaseConnectionSettingsStorageSchema.safeParse(parsed);

      if (!result.success) {
        logger.warn('supabase connection settings parse failed', {
          issues: result.error.issues,
        });
        return createDefaultSupabaseConnectionSettings();
      }

      return {
        greenBean: result.data.greenBean,
        roastedBean: result.data.roastedBean,
        updatedAt: result.data.updatedAt ?? null,
      };
    } catch (error) {
      logger.error('supabase connection settings load failed', { error });
      return createDefaultSupabaseConnectionSettings();
    }
  },
  resolveProjectConnection(dataSource: SupabaseDataSource): SupabaseProjectConnection {
    return this.load()[dataSource];
  },
  save(settings: SupabaseConnectionSettings): SupabaseConnectionSettings {
    if (!canUseStorage()) {
      return settings;
    }

    const serialized = JSON.stringify(settings);

    window.localStorage.setItem(supabaseConnectionSettingsStorageKey, serialized);
    window.localStorage.removeItem(legacySupabaseConnectionSettingsBackupStorageKey);
    logger.info('supabase connection settings saved', {
      updatedAt: settings.updatedAt,
    });

    return settings;
  },
};
