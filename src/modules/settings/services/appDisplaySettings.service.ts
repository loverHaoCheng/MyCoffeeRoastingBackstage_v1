import { appDisplaySettingsStorageSchema } from '@/modules/settings/schemas';
import { createDefaultAppDisplaySettings, type AppDisplaySettings } from '@/modules/settings/types';
import { logger } from '@/shared/logger/logger';

export const appDisplaySettingsStorageKey = 'coffee-roasting-backstage:app-display-settings';

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export const appDisplaySettingsService = {
  clear(): void {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(appDisplaySettingsStorageKey);
  },
  load(): AppDisplaySettings {
    if (!canUseStorage()) {
      return createDefaultAppDisplaySettings();
    }

    const rawValue = window.localStorage.getItem(appDisplaySettingsStorageKey);

    if (!rawValue) {
      return createDefaultAppDisplaySettings();
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;
      const result = appDisplaySettingsStorageSchema.safeParse(parsed);

      if (!result.success) {
        logger.warn('app display settings parse failed', {
          issues: result.error.issues,
        });

        return createDefaultAppDisplaySettings();
      }

      return {
        scale: result.data.scale,
        updatedAt: result.data.updatedAt ?? null,
      };
    } catch (error) {
      logger.error('app display settings load failed', { error });

      return createDefaultAppDisplaySettings();
    }
  },
  save(settings: AppDisplaySettings): AppDisplaySettings {
    if (!canUseStorage()) {
      return settings;
    }

    window.localStorage.setItem(appDisplaySettingsStorageKey, JSON.stringify(settings));
    logger.info('app display settings saved', {
      scale: settings.scale,
      updatedAt: settings.updatedAt,
    });

    return settings;
  },
};
