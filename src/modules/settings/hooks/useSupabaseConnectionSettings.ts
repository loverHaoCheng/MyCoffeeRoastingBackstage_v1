import { useSettingsStore } from '@/modules/settings/store';

export function useSupabaseConnectionSettings() {
  const loadSupabaseConnections = useSettingsStore((state) => state.loadSupabaseConnections);
  const supabaseConnections = useSettingsStore((state) => state.supabaseConnections);
  const saveSupabaseConnections = useSettingsStore((state) => state.saveSupabaseConnections);
  const resetSupabaseConnections = useSettingsStore((state) => state.resetSupabaseConnections);

  return {
    loadSupabaseConnections,
    resetSupabaseConnections,
    saveSupabaseConnections,
    supabaseConnections,
  };
}
