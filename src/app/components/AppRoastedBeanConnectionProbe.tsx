import { useEffect, useRef } from 'react';

import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { pocketBaseConnectionRuntimeService } from '@/modules/settings/services/pocketBaseConnectionRuntime.service';
import { pocketBaseConnectionProbeService } from '@/modules/settings/services/pocketBaseConnectionProbe.service';
import { hasSyncableRoastedBeanConnection } from '@/modules/settings/services/roastedBeanSupabaseConnectionSync.service';
import { useSettingsStore } from '@/modules/settings/store';

export function AppRoastedBeanConnectionProbe() {
  const probedUserIdRef = useRef<null | string>(null);
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const loadPocketBaseConnections = useSettingsStore((state) => state.loadPocketBaseConnections);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      probedUserIdRef.current = null;
      return;
    }

    if (probedUserIdRef.current === userId) {
      return;
    }

    probedUserIdRef.current = userId;

    void (async () => {
      await loadPocketBaseConnections({ forceRemote: true });

      const connection = useSettingsStore.getState().pocketBaseConnections.roastedBean;

      if (!hasSyncableRoastedBeanConnection(connection)) {
        pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(connection, 'unconfigured');
        return;
      }

      if (pocketBaseConnectionRuntimeService.readRoastedBeanConnectionStatus(connection) != null) {
        return;
      }

      pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(connection, 'checking');

      try {
        await pocketBaseConnectionProbeService.verify('roastedBean', connection);
        pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(connection, 'connected');
      } catch {
        pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(connection, 'disconnected');
      }
    })();
  }, [isAuthenticated, loadPocketBaseConnections, userId]);

  return null;
}
