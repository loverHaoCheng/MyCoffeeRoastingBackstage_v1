import { costTemplateSettingsStorageSchema } from '@/modules/settings/schemas';
import { costTemplateSettingsService } from '@/modules/settings/services/costTemplateSettings.service';
import { appSettingsSyncService, type AppSettingRecord } from '@/modules/settings/services/appSettingsSync.service';
import type { CostTemplate, CostTemplateSettings } from '@/modules/settings/types';
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
    defaultTemplateId: hasDefaultTemplate ? result.data.defaultTemplateId ?? null : result.data.templates[0]?.id ?? null,
    templates: result.data.templates,
    updatedAt: result.data.updatedAt ?? record.updated_at ?? null,
  };
};

const buildTemplateSnapshot = (settings: CostTemplateSettings): string => {
  return JSON.stringify(
    [...settings.templates]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((template) => `${template.id}:${template.updatedAt}`),
  );
};

const mergeTemplateSettings = (
  localSettings: CostTemplateSettings,
  remoteSettings: CostTemplateSettings,
): CostTemplateSettings => {
  const mergedTemplates = new Map<string, CostTemplate>();

  remoteSettings.templates.forEach((template) => {
    mergedTemplates.set(template.id, template);
  });

  localSettings.templates.forEach((template) => {
    if (!mergedTemplates.has(template.id)) {
      mergedTemplates.set(template.id, template);
    }
  });

  const templates = [...mergedTemplates.values()].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

  const defaultTemplateId =
    remoteSettings.defaultTemplateId && mergedTemplates.has(remoteSettings.defaultTemplateId)
      ? remoteSettings.defaultTemplateId
      : localSettings.defaultTemplateId && mergedTemplates.has(localSettings.defaultTemplateId)
        ? localSettings.defaultTemplateId
        : templates[0]?.id ?? null;

  const updatedAtCandidates = [remoteSettings.updatedAt, localSettings.updatedAt]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

  return {
    defaultTemplateId,
    templates,
    updatedAt: updatedAtCandidates[0] ?? null,
  };
};

export const costTemplateSyncService = {
  async loadRemote(): Promise<CostTemplateSettings | null> {
    const record = await appSettingsSyncService.loadRecord(costTemplateSettingsKey);

    return record ? parseRemoteSettings(record) : null;
  },
  async saveRemote(settings: CostTemplateSettings): Promise<void> {
    await appSettingsSyncService.saveRecord(costTemplateSettingsKey, settings);
  },
  async sync(localSettings = costTemplateSettingsService.load()): Promise<CostTemplateSettings> {
    const remoteSettings = await this.loadRemote();

    if (!remoteSettings) {
      await this.saveRemote(localSettings);
      return costTemplateSettingsService.save(localSettings);
    }

    const mergedSettings = mergeTemplateSettings(localSettings, remoteSettings);

    if (buildTemplateSnapshot(remoteSettings) !== buildTemplateSnapshot(mergedSettings)) {
      await this.saveRemote(mergedSettings);
    }

    return costTemplateSettingsService.save(mergedSettings);
  },
  async syncSafely(localSettings = costTemplateSettingsService.load()): Promise<CostTemplateSettings> {
    try {
      return await this.sync(localSettings);
    } catch (error) {
      logger.warn('cost template remote sync failed', { error });
      return localSettings;
    }
  },
};
