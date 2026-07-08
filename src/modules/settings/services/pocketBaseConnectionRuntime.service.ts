import {
  normalizeRoastedBeanPocketBaseProjectConnection,
  type PocketBaseProjectConnection,
} from '@/modules/settings/types';

export type RoastedBeanConnectionRuntimeStatus =
  | 'checking'
  | 'connected'
  | 'disconnected'
  | 'unconfigured';

interface CachedRoastedBeanConnectionStatus {
  signature: string;
  status: RoastedBeanConnectionRuntimeStatus;
}

let hasLoadedPocketBaseConnectionsThisSession = false;
let cachedRoastedBeanConnectionStatus: CachedRoastedBeanConnectionStatus | null = null;

const buildRoastedBeanConnectionSignature = (
  connection: PocketBaseProjectConnection,
): string => {
  return JSON.stringify(
    normalizeRoastedBeanPocketBaseProjectConnection(connection),
  );
};

export const pocketBaseConnectionRuntimeService = {
  clear(): void {
    cachedRoastedBeanConnectionStatus = null;
    hasLoadedPocketBaseConnectionsThisSession = false;
  },
  hasLoadedPocketBaseConnectionsThisSession(): boolean {
    return hasLoadedPocketBaseConnectionsThisSession;
  },
  markPocketBaseConnectionsLoadedThisSession(): void {
    hasLoadedPocketBaseConnectionsThisSession = true;
  },
  readRoastedBeanConnectionStatus(
    connection: PocketBaseProjectConnection,
  ): RoastedBeanConnectionRuntimeStatus | null {
    if (cachedRoastedBeanConnectionStatus == null) {
      return null;
    }

    return cachedRoastedBeanConnectionStatus.signature ===
      buildRoastedBeanConnectionSignature(connection)
      ? cachedRoastedBeanConnectionStatus.status
      : null;
  },
  saveRoastedBeanConnectionStatus(
    connection: PocketBaseProjectConnection,
    status: RoastedBeanConnectionRuntimeStatus,
  ): void {
    cachedRoastedBeanConnectionStatus = {
      signature: buildRoastedBeanConnectionSignature(connection),
      status,
    };
  },
};
