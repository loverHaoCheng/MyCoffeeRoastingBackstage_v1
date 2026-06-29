import { useSettingsStore } from '@/modules/settings/store';

export function useCostTemplateSettings() {
  const costTemplateSettings = useSettingsStore((state) => state.costTemplateSettings);
  const deleteCostTemplate = useSettingsStore((state) => state.deleteCostTemplate);
  const loadCostTemplates = useSettingsStore((state) => state.loadCostTemplates);
  const resetCostTemplates = useSettingsStore((state) => state.resetCostTemplates);
  const saveCostTemplate = useSettingsStore((state) => state.saveCostTemplate);
  const setDefaultCostTemplate = useSettingsStore((state) => state.setDefaultCostTemplate);

  return {
    costTemplateSettings,
    deleteCostTemplate,
    loadCostTemplates,
    resetCostTemplates,
    saveCostTemplate,
    setDefaultCostTemplate,
  };
}
