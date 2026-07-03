import { appDisplaySettingsStorageSchema } from '@/modules/settings/schemas';
import { appDisplaySettingsService } from '@/modules/settings/services/appDisplaySettings.service';
import { appSettingsSyncService, type AppSettingRecord } from '@/modules/settings/services/appSettingsSync.service';
import type { AppDisplaySettings } from '@/modules/settings/types';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';

const appDisplaySettingsKey = 'app_display_settings';

const toUpdatedAtTimestamp = (value: null | string): number => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

const parseRemoteSettings = (record: AppSettingRecord): AppDisplaySettings => {
  const result = appDisplaySettingsStorageSchema.safeParse(record.value);

  if (!result.success) {
    throw new AppError('显示缩放远端数据格式无效。', {
      code: 'DATA',
      cause: result.error,
    });
  }

  return {
    scale: result.data.scale,
    updatedAt: result.data.updatedAt ?? record.updated_at ?? null,
  };
};

export const appDisplaySettingsSyncService = {
  async loadRemote(): Promise<AppDisplaySettings | null> {
    const record = await appSettingsSyncService.loadRecord(appDisplaySettingsKey);

    return record ? parseRemoteSettings(record) : null;
  },
  async saveRemote(settings: AppDisplaySettings): Promise<void> {
    await appSettingsSyncService.saveRecord(appDisplaySettingsKey, settings);
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

    return appDisplaySettingsService.save(remoteSettings);
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
