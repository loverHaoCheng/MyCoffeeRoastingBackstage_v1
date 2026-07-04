import { create } from 'zustand';

import { appDisplaySettingsService } from '@/modules/settings/services/appDisplaySettings.service';
import { costTemplateSettingsService } from '@/modules/settings/services/costTemplateSettings.service';
import { supabaseConnectionSettingsService } from '@/modules/settings/services/supabaseConnectionSettings.service';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultSupabaseConnectionSettings,
  normalizeAppDisplaySettings,
  type AppDisplaySettings,
  type CostTemplate,
  type CostTemplateFormValues,
  type CostTemplateSettings,
  type SupabaseConnectionFormValues,
  type SupabaseConnectionSettings,
} from '@/modules/settings/types';

interface SettingsState {
  appDisplaySettings: AppDisplaySettings;
  costTemplateSettings: CostTemplateSettings;
  deleteCostTemplate: (templateId: string) => void;
  loadAppDisplaySettings: () => void;
  loadCostTemplates: () => void;
  loadSupabaseConnections: () => void;
  resetAppDisplaySettings: () => void;
  saveCostTemplate: (values: CostTemplateFormValues, templateId?: string) => CostTemplate;
  saveAppDisplaySettings: (settings: AppDisplaySettings) => AppDisplaySettings;
  setDefaultCostTemplate: (templateId: string) => void;
  supabaseConnections: SupabaseConnectionSettings;
  resetCostTemplates: () => void;
  resetSupabaseConnections: () => void;
  saveSupabaseConnections: (values: SupabaseConnectionFormValues) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  appDisplaySettings: appDisplaySettingsService.load(),
  costTemplateSettings: costTemplateSettingsService.load(),
  supabaseConnections: supabaseConnectionSettingsService.load(),
  deleteCostTemplate: (templateId) => {
    set((state) => {
      const nextTemplates = state.costTemplateSettings.templates.filter((template) => template.id !== templateId);
      const fallbackSettings =
        nextTemplates.length > 0
          ? {
              defaultTemplateId:
                state.costTemplateSettings.defaultTemplateId === templateId
                  ? nextTemplates[0]?.id ?? null
                  : state.costTemplateSettings.defaultTemplateId,
              templates: nextTemplates,
              updatedAt: new Date().toISOString(),
            }
          : createDefaultCostTemplateSettings();

      const nextValue = costTemplateSettingsService.save(fallbackSettings);

      return { costTemplateSettings: nextValue };
    });
  },
  loadCostTemplates: () => {
    set({
      costTemplateSettings: costTemplateSettingsService.load(),
    });
  },
  loadAppDisplaySettings: () => {
    set({
      appDisplaySettings: appDisplaySettingsService.load(),
    });
  },
  loadSupabaseConnections: () => {
    set({
      supabaseConnections: supabaseConnectionSettingsService.load(),
    });
  },
  saveCostTemplate: (values, templateId) => {
    const currentSettings = costTemplateSettingsService.load();
    const existingTemplate = currentSettings.templates.find((template) => template.id === templateId);
    const nextTemplate = costTemplateSettingsService.createTemplate(
      values,
      existingTemplate?.id,
      existingTemplate?.createdAt,
    );
    const nextTemplates = existingTemplate
      ? currentSettings.templates.map((template) => (template.id === existingTemplate.id ? nextTemplate : template))
      : [nextTemplate, ...currentSettings.templates];
    const nextSettings: CostTemplateSettings = {
      defaultTemplateId:
        currentSettings.defaultTemplateId ?? nextTemplates[0]?.id ?? nextTemplate.id,
      templates: nextTemplates,
      updatedAt: new Date().toISOString(),
    };

    costTemplateSettingsService.save(nextSettings);
    set({ costTemplateSettings: nextSettings });

    return nextTemplate;
  },
  setDefaultCostTemplate: (templateId) => {
    set((state) => {
      if (!state.costTemplateSettings.templates.some((template) => template.id === templateId)) {
        return state;
      }

      const nextValue = costTemplateSettingsService.save({
        ...state.costTemplateSettings,
        defaultTemplateId: templateId,
        updatedAt: new Date().toISOString(),
      });

      return { costTemplateSettings: nextValue };
    });
  },
  resetCostTemplates: () => {
    const nextValue = createDefaultCostTemplateSettings();

    costTemplateSettingsService.clear();
    costTemplateSettingsService.save(nextValue);
    set({ costTemplateSettings: nextValue });
  },
  resetAppDisplaySettings: () => {
    const nextValue = createDefaultAppDisplaySettings();

    appDisplaySettingsService.clear();
    appDisplaySettingsService.save(nextValue);
    set({ appDisplaySettings: nextValue });
  },
  resetSupabaseConnections: () => {
    const nextValue = createDefaultSupabaseConnectionSettings();

    supabaseConnectionSettingsService.clear();
    set({ supabaseConnections: nextValue });
  },
  saveSupabaseConnections: (values) => {
    const nextValue: SupabaseConnectionSettings = {
      ...values,
      updatedAt: new Date().toISOString(),
    };

    supabaseConnectionSettingsService.save(nextValue);
    set({ supabaseConnections: nextValue });
  },
  saveAppDisplaySettings: (settings) => {
    const nextValue = normalizeAppDisplaySettings({
      ...settings,
      updatedAt: new Date().toISOString(),
    });

    appDisplaySettingsService.save(nextValue);
    set({ appDisplaySettings: nextValue });

    return nextValue;
  },
}));
