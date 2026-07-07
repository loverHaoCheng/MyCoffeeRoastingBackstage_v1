import { costTemplateSettingsStorageSchema } from '@/modules/settings/schemas';
import { appSettingsSyncService, type AppSettingRecord } from '@/modules/settings/services/appSettingsSync.service';
import { costTemplateSettingsService } from '@/modules/settings/services/costTemplateSettings.service';
import { createDefaultCostTemplateSettings, type CostTemplateSettings } from '@/modules/settings/types';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';

const costTemplateSettingsKey = 'cost_template_settings';

const parseRemoteSettings = (record: AppSettingRecord): CostTemplateSettings => {
  const result = costTemplateSettingsStorageSchema.safeParse(record.value);

  if (!result.success) {
    throw new AppError('成本模板远端数据格式无效。', {
      code: 'DATA',
      cause: result.error,
    });
  }

  const hasDefaultTemplate =
    result.data.defaultTemplateId == null ||
    result.data.templates.some((template) => template.id === result.data.defaultTemplateId);

  return {
    defaultTemplateId: hasDefaultTemplate ? result.data.defaultTemplateId ?? null : null,
    templates: result.data.templates,
    updatedAt: result.data.updatedAt ?? record.updated_at ?? null,
  };
};

const normalizeRemoteResult = (remoteSettings: CostTemplateSettings | null): CostTemplateSettings => {
  return remoteSettings ?? createDefaultCostTemplateSettings();
};

export const costTemplateSyncService = {
  async loadRemote(): Promise<CostTemplateSettings | null> {
    const record = await appSettingsSyncService.loadRecord(costTemplateSettingsKey);

    return record ? parseRemoteSettings(record) : null;
  },
  async saveRemote(settings: CostTemplateSettings): Promise<void> {
    await appSettingsSyncService.saveRecord(costTemplateSettingsKey, settings);
  },
  async syncFromRemote(): Promise<CostTemplateSettings> {
    const nextSettings = normalizeRemoteResult(await this.loadRemote());

    return costTemplateSettingsService.save(nextSettings);
  },
  async syncFromRemoteSafely(): Promise<CostTemplateSettings> {
    try {
      return await this.syncFromRemote();
    } catch (error) {
      logger.warn('cost template remote pull failed', { error });
      return costTemplateSettingsService.load();
    }
  },
  async syncLocalChange(localSettings = costTemplateSettingsService.load()): Promise<CostTemplateSettings> {
    await this.saveRemote(localSettings);

    return costTemplateSettingsService.save(localSettings);
  },
  async syncLocalChangeSafely(localSettings = costTemplateSettingsService.load()): Promise<CostTemplateSettings> {
    try {
      return await this.syncLocalChange(localSettings);
    } catch (error) {
      logger.warn('cost template remote push failed', { error });
      return localSettings;
    }
  },
};
