import { create } from 'zustand';

import { costTemplateSettingsService } from '@/modules/settings/services/costTemplateSettings.service';
import { supabaseConnectionSettingsService } from '@/modules/settings/services/supabaseConnectionSettings.service';
import {
  createDefaultCostTemplateSettings,
  createDefaultSupabaseConnectionSettings,
  type CostTemplate,
  type CostTemplateFormValues,
  type CostTemplateSettings,
  type SupabaseConnectionFormValues,
  type SupabaseConnectionSettings,
} from '@/modules/settings/types';

interface SettingsState {
  costTemplateSettings: CostTemplateSettings;
  deleteCostTemplate: (templateId: string) => void;
  loadCostTemplates: () => void;
  loadSupabaseConnections: () => void;
  saveCostTemplate: (values: CostTemplateFormValues, templateId?: string) => CostTemplate;
  setDefaultCostTemplate: (templateId: string) => void;
  supabaseConnections: SupabaseConnectionSettings;
  resetCostTemplates: () => void;
  resetSupabaseConnections: () => void;
  saveSupabaseConnections: (values: SupabaseConnectionFormValues) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
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
                  ? nextTemplates[0]!.id
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
}));
