import { costTemplateSettingsStorageSchema } from '@/modules/settings/schemas';
import {
  createDefaultCostTemplateSettings,
  type CostTemplate,
  type CostTemplateFormValues,
  type CostTemplateSettings,
} from '@/modules/settings/types';
import { logger } from '@/shared/logger/logger';

export const costTemplateSettingsStorageKey = 'coffee-roasting-backstage:cost-templates';

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const createTemplateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeTemplateInput = (values: CostTemplateFormValues): CostTemplateFormValues => ({
  ...values,
  name: values.name.trim(),
  notes: values.notes.trim(),
});

export const costTemplateSettingsService = {
  clear(): void {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(costTemplateSettingsStorageKey);
  },
  createTemplate(values: CostTemplateFormValues, templateId?: string, createdAt?: string): CostTemplate {
    const timestamp = new Date().toISOString();
    const normalized = normalizeTemplateInput(values);

    return {
      ...normalized,
      createdAt: createdAt ?? timestamp,
      id: templateId ?? createTemplateId(),
      updatedAt: timestamp,
    };
  },
  load(): CostTemplateSettings {
    if (!canUseStorage()) {
      return createDefaultCostTemplateSettings();
    }

    const rawValue = window.localStorage.getItem(costTemplateSettingsStorageKey);

    if (!rawValue) {
      return createDefaultCostTemplateSettings();
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;
      const result = costTemplateSettingsStorageSchema.safeParse(parsed);

      if (!result.success) {
        logger.warn('cost template settings parse failed', {
          issues: result.error.issues,
        });

        return createDefaultCostTemplateSettings();
      }

      if (result.data.templates.length === 0) {
        return createDefaultCostTemplateSettings();
      }

      const hasDefaultTemplate = result.data.templates.some((template) => template.id === result.data.defaultTemplateId);

      return {
        defaultTemplateId: hasDefaultTemplate ? result.data.defaultTemplateId ?? null : result.data.templates[0]!.id,
        templates: result.data.templates,
        updatedAt: result.data.updatedAt ?? null,
      };
    } catch (error) {
      logger.error('cost template settings load failed', { error });

      return createDefaultCostTemplateSettings();
    }
  },
  save(settings: CostTemplateSettings): CostTemplateSettings {
    if (!canUseStorage()) {
      return settings;
    }

    window.localStorage.setItem(costTemplateSettingsStorageKey, JSON.stringify(settings));
    logger.info('cost template settings saved', {
      templateCount: settings.templates.length,
      updatedAt: settings.updatedAt,
    });

    return settings;
  },
};
