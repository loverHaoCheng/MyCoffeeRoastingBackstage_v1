import { appDisplaySettingsStorageSchema } from '@/modules/settings/schemas';
import {
  createDefaultAppDisplaySettings,
  normalizeAppDisplaySettings,
  type AppDisplaySettings,
} from '@/modules/settings/types';
import { logger } from '@/shared/logger/logger';

export const appDisplaySettingsStorageKey = 'coffee-roasting-backstage:app-display-settings';

let currentAppDisplaySettings: AppDisplaySettings = createDefaultAppDisplaySettings();

export const appDisplaySettingsService = {
  clear(): void {
    currentAppDisplaySettings = createDefaultAppDisplaySettings();
  },
  load(): AppDisplaySettings {
    const result = appDisplaySettingsStorageSchema.safeParse(currentAppDisplaySettings);

    if (!result.success) {
      logger.warn('app display settings memory state parse failed', {
        issues: result.error.issues,
      });

      currentAppDisplaySettings = createDefaultAppDisplaySettings();
    }

    return normalizeAppDisplaySettings(currentAppDisplaySettings);
  },
  save(settings: AppDisplaySettings): AppDisplaySettings {
    const normalizedSettings = normalizeAppDisplaySettings(settings);

    currentAppDisplaySettings = normalizedSettings;
    logger.info('app display settings saved', {
      scale: normalizedSettings.scale,
      themeMode: normalizedSettings.themeMode,
      updatedAt: normalizedSettings.updatedAt,
    });

    return normalizedSettings;
  },
};
