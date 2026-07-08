import { create } from 'zustand';

import { appDisplaySettingsService } from '@/modules/settings/services/appDisplaySettings.service';
import { costTemplateSettingsService } from '@/modules/settings/services/costTemplateSettings.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { pocketBaseConnectionRuntimeService } from '@/modules/settings/services/pocketBaseConnectionRuntime.service';
import { supabaseRoastedBeanConnectionSyncService } from '@/modules/settings/services/supabaseRoastedBeanConnectionSync.service';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
  normalizeAppDisplaySettings,
  type AppDisplaySettings,
  type CostTemplate,
  type CostTemplateFormValues,
  type CostTemplateSettings,
  type PocketBaseConnectionFormValues,
  type PocketBaseConnectionSettings,
} from '@/modules/settings/types';

interface SettingsState {
  appDisplaySettings: AppDisplaySettings;
  costTemplateSettings: CostTemplateSettings;
  deleteCostTemplate: (templateId: string) => void;
  loadAppDisplaySettings: () => void;
  loadCostTemplates: () => void;
  loadPocketBaseConnections: (options?: { forceRemote?: boolean }) => Promise<void>;
  resetAppDisplaySettings: () => void;
  saveAppDisplaySettings: (settings: AppDisplaySettings) => AppDisplaySettings;
  saveCostTemplate: (values: CostTemplateFormValues, templateId?: string) => CostTemplate;
  savePocketBaseConnections: (values: PocketBaseConnectionFormValues) => void;
  setDefaultCostTemplate: (templateId: null | string) => void;
  pocketBaseConnections: PocketBaseConnectionSettings;
  resetCostTemplates: () => void;
  resetPocketBaseConnections: () => void;
}

const initialPocketBaseConnections = pocketBaseConnectionSettingsService.load();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  appDisplaySettings: appDisplaySettingsService.load(),
  costTemplateSettings: costTemplateSettingsService.load(),
  pocketBaseConnections: initialPocketBaseConnections,
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
  loadAppDisplaySettings: () => {
    set({
      appDisplaySettings: appDisplaySettingsService.load(),
    });
  },
  loadCostTemplates: () => {
    set({
      costTemplateSettings: costTemplateSettingsService.load(),
    });
  },
  loadPocketBaseConnections: async (options) => {
    if (
      options?.forceRemote !== true &&
      pocketBaseConnectionRuntimeService.hasLoadedPocketBaseConnectionsThisSession()
    ) {
      set({
        pocketBaseConnections: pocketBaseConnectionSettingsService.load(),
      });
      return;
    }

    const nextValue = await supabaseRoastedBeanConnectionSyncService.syncFromRemoteSafely();

    pocketBaseConnectionRuntimeService.markPocketBaseConnectionsLoadedThisSession();

    set({
      pocketBaseConnections: nextValue,
    });
  },
  resetAppDisplaySettings: () => {
    const nextValue = createDefaultAppDisplaySettings();

    appDisplaySettingsService.clear();
    appDisplaySettingsService.save(nextValue);
    set({ appDisplaySettings: nextValue });
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
  saveCostTemplate: (values, templateId) => {
    const currentSettings = get().costTemplateSettings;
    const existingTemplate = currentSettings.templates.find((template) => template.id === templateId);
    const savedTemplate = costTemplateSettingsService.createTemplate(
      values,
      existingTemplate?.id,
      existingTemplate?.createdAt,
    );
    const nextTemplates = existingTemplate
      ? currentSettings.templates.map((template) => (template.id === existingTemplate.id ? savedTemplate : template))
      : [savedTemplate, ...currentSettings.templates];
    const nextSettings: CostTemplateSettings = {
      defaultTemplateId:
        currentSettings.defaultTemplateId ??
        (currentSettings.templates.length === 0 && !existingTemplate ? savedTemplate.id : null),
      templates: nextTemplates,
      updatedAt: new Date().toISOString(),
    };

    costTemplateSettingsService.save(nextSettings);
    set({ costTemplateSettings: nextSettings });

    return savedTemplate;
  },
  savePocketBaseConnections: (values) => {
    const nextValue: PocketBaseConnectionSettings = {
      ...values,
      updatedAt: new Date().toISOString(),
    };

    const savedValue = pocketBaseConnectionSettingsService.save(nextValue);
    set({
      pocketBaseConnections: savedValue,
    });
  },
  setDefaultCostTemplate: (templateId) => {
    set((state) => {
      if (templateId != null && !state.costTemplateSettings.templates.some((template) => template.id === templateId)) {
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
  resetPocketBaseConnections: () => {
    const nextValue = createDefaultPocketBaseConnectionSettings();

    pocketBaseConnectionSettingsService.clear();
    set({
      pocketBaseConnections: nextValue,
    });
  },
}));
