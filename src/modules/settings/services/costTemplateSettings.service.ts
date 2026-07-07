import { costTemplateSettingsStorageSchema } from '@/modules/settings/schemas';
import {
  createDefaultCostTemplateSettings,
  type CostTemplate,
  type CostTemplateFormValues,
  type CostTemplateSettings,
} from '@/modules/settings/types';
import { logger } from '@/shared/logger/logger';

export const costTemplateSettingsStorageKey = 'coffee-roasting-backstage:cost-templates';

let currentCostTemplateSettings: CostTemplateSettings = createDefaultCostTemplateSettings();

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
    currentCostTemplateSettings = createDefaultCostTemplateSettings();
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
    const result = costTemplateSettingsStorageSchema.safeParse(currentCostTemplateSettings);

    if (!result.success) {
      logger.warn('cost template settings memory state parse failed', {
        issues: result.error.issues,
      });
      currentCostTemplateSettings = createDefaultCostTemplateSettings();
      return createDefaultCostTemplateSettings();
    }

    const hasDefaultTemplate =
      result.data.defaultTemplateId == null ||
      result.data.templates.some((template) => template.id === result.data.defaultTemplateId);

    return {
      defaultTemplateId: hasDefaultTemplate ? result.data.defaultTemplateId ?? null : null,
      templates: result.data.templates,
      updatedAt: result.data.updatedAt ?? null,
    };
  },
  save(settings: CostTemplateSettings): CostTemplateSettings {
    currentCostTemplateSettings = settings;
    logger.info('cost template settings saved', {
      templateCount: settings.templates.length,
      updatedAt: settings.updatedAt,
    });

    return settings;
  },
};
