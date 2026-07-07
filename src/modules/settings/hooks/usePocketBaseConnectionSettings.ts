import { useSettingsStore } from '@/modules/settings/store';

export function usePocketBaseConnectionSettings() {
  const loadPocketBaseConnections = useSettingsStore((state) => state.loadPocketBaseConnections);
  const pocketBaseConnections = useSettingsStore((state) => state.pocketBaseConnections);
  const savePocketBaseConnections = useSettingsStore((state) => state.savePocketBaseConnections);
  const resetPocketBaseConnections = useSettingsStore((state) => state.resetPocketBaseConnections);

  return {
    loadPocketBaseConnections,
    pocketBaseConnections,
    resetPocketBaseConnections,
    savePocketBaseConnections,
  };
}
