import { useSyncExternalStore } from 'react';

import {
  appBuildVersionService,
  appBuildVersionUpdatedEventName,
} from '@/app/services/appBuildVersion.service';

export function useAppBuildVersion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(appBuildVersionUpdatedEventName, onStoreChange);
      window.addEventListener('storage', onStoreChange);

      return () => {
        window.removeEventListener(appBuildVersionUpdatedEventName, onStoreChange);
        window.removeEventListener('storage', onStoreChange);
      };
    },
    () => appBuildVersionService.get() ?? __APP_BUILD_VERSION__,
    () => __APP_BUILD_VERSION__,
  );
}
