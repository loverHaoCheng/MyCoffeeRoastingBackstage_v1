import { useSettingsStore } from '@/modules/settings/store';

export function useAppDisplaySettings() {
  const appDisplaySettings = useSettingsStore((state) => state.appDisplaySettings);
  const loadAppDisplaySettings = useSettingsStore((state) => state.loadAppDisplaySettings);
  const resetAppDisplaySettings = useSettingsStore((state) => state.resetAppDisplaySettings);
  const saveAppDisplaySettings = useSettingsStore((state) => state.saveAppDisplaySettings);

  return {
    appDisplaySettings,
    loadAppDisplaySettings,
    resetAppDisplaySettings,
    saveAppDisplaySettings,
  };
}
