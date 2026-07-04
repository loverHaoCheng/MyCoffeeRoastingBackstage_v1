import { appDisplaySettingsStorageSchema } from '@/modules/settings/schemas';
import { appDisplaySettingsService } from '@/modules/settings/services/appDisplaySettings.service';
import { appSettingsSyncService, type AppSettingRecord } from '@/modules/settings/services/appSettingsSync.service';
import { normalizeAppDisplaySettings, type AppDisplaySettings, type AppThemeMode } from '@/modules/settings/types';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';

const appDisplaySettingsKey = 'app_display_settings';
type AppDisplaySettingsSyncPayload = Omit<AppDisplaySettings, 'themeMode'>;

const toUpdatedAtTimestamp = (value: null | string): number => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

const toSyncPayload = (settings: AppDisplaySettings): AppDisplaySettingsSyncPayload => {
  return {
    cardDisplaySettings: settings.cardDisplaySettings,
    scale: settings.scale,
    updatedAt: settings.updatedAt,
  };
};

const mergeLocalThemeMode = (
  settings: AppDisplaySettingsSyncPayload,
  themeMode: AppThemeMode,
): AppDisplaySettings => {
  return normalizeAppDisplaySettings({
    ...settings,
    themeMode,
    updatedAt: settings.updatedAt ?? null,
  });
};

const parseRemoteSettings = (record: AppSettingRecord): AppDisplaySettingsSyncPayload => {
  const result = appDisplaySettingsStorageSchema.safeParse(record.value);

  if (!result.success) {
    throw new AppError('显示缩放远端数据格式无效。', {
      code: 'DATA',
      cause: result.error,
    });
  }

  const normalized = normalizeAppDisplaySettings({
    ...result.data,
    updatedAt: result.data.updatedAt ?? record.updated_at ?? null,
  });

  return toSyncPayload(normalized);
};

export const appDisplaySettingsSyncService = {
  async loadRemote(): Promise<AppDisplaySettingsSyncPayload | null> {
    const record = await appSettingsSyncService.loadRecord(appDisplaySettingsKey);

    return record ? parseRemoteSettings(record) : null;
  },
  async saveRemote(settings: AppDisplaySettings): Promise<void> {
    await appSettingsSyncService.saveRecord(appDisplaySettingsKey, toSyncPayload(settings));
  },
  async sync(localSettings = appDisplaySettingsService.load()): Promise<AppDisplaySettings> {
    const remoteSettings = await this.loadRemote();

    if (!remoteSettings) {
      await this.saveRemote(localSettings);
      return appDisplaySettingsService.save(localSettings);
    }

    const localUpdatedAt = toUpdatedAtTimestamp(localSettings.updatedAt);
    const remoteUpdatedAt = toUpdatedAtTimestamp(remoteSettings.updatedAt);
    const shouldUploadLocal =
      localUpdatedAt > remoteUpdatedAt ||
      (localUpdatedAt === remoteUpdatedAt &&
        localSettings.updatedAt != null &&
        localSettings.scale !== remoteSettings.scale);

    if (shouldUploadLocal) {
      await this.saveRemote(localSettings);
      return appDisplaySettingsService.save(localSettings);
    }

    return appDisplaySettingsService.save(mergeLocalThemeMode(remoteSettings, localSettings.themeMode));
  },
  async syncSafely(localSettings = appDisplaySettingsService.load()): Promise<AppDisplaySettings> {
    try {
      return await this.sync(localSettings);
    } catch (error) {
      logger.warn('app display remote sync failed', { error });
      return localSettings;
    }
  },
};
