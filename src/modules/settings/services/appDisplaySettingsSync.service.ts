import { appDisplaySettingsStorageSchema } from '@/modules/settings/schemas';
import { appDisplaySettingsService } from '@/modules/settings/services/appDisplaySettings.service';
import { appSettingsSyncService, type AppSettingRecord } from '@/modules/settings/services/appSettingsSync.service';
import { normalizeAppDisplaySettings, type AppDisplaySettings } from '@/modules/settings/types';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';

const appDisplaySettingsKey = 'app_display_settings';
type AppDisplaySettingsSyncPayload = Pick<AppDisplaySettings, 'cardDisplaySettings' | 'updatedAt'>;

const normalizeIsoDatetime = (value: null | string | undefined): null | string => {
  if (!value) {
    return null;
  }

  const normalizedValue = value.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T');
  const timestamp = new Date(normalizedValue).getTime();

  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
};

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
    updatedAt: settings.updatedAt,
  };
};

const mergeLocalDisplayPreferences = (
  settings: AppDisplaySettingsSyncPayload,
  localSettings: AppDisplaySettings,
): AppDisplaySettings => {
  return normalizeAppDisplaySettings({
    ...settings,
    scale: localSettings.scale,
    themeMode: localSettings.themeMode,
    updatedAt: settings.updatedAt ?? null,
  });
};

const buildSyncSignature = (settings: AppDisplaySettingsSyncPayload): string => {
  return JSON.stringify({
    cardDisplaySettings: settings.cardDisplaySettings,
  });
};

const parseRemoteSettings = (record: AppSettingRecord): AppDisplaySettingsSyncPayload => {
  const result = appDisplaySettingsStorageSchema.safeParse(record.value);

  if (!result.success) {
    throw new AppError('应用显示设置远端数据格式无效。', {
      code: 'DATA',
      cause: result.error,
    });
  }

  const normalized = normalizeAppDisplaySettings({
    ...result.data,
    updatedAt: normalizeIsoDatetime(result.data.updatedAt ?? record.updated_at),
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
    const localSignature = buildSyncSignature(toSyncPayload(localSettings));
    const remoteSignature = buildSyncSignature(remoteSettings);
    const shouldUploadLocal =
      localSignature !== remoteSignature && localUpdatedAt >= remoteUpdatedAt;

    if (shouldUploadLocal) {
      await this.saveRemote(localSettings);
      return appDisplaySettingsService.save(localSettings);
    }

    return appDisplaySettingsService.save(
      mergeLocalDisplayPreferences(remoteSettings, localSettings),
    );
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
