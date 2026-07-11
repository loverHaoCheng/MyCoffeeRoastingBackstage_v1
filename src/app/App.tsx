import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { AppRealtimeSync } from '@/app/components/AppRealtimeSync';
import { AppAuthBootstrap } from '@/app/components/AppAuthBootstrap';
import { AppUpdateBanner } from '@/app/components/AppUpdateBanner';
import { AppProviders } from '@/app/providers/AppProviders';
import { router } from '@/router/routes';
import { localStorageCleanupService } from '@/shared/services/localStorageCleanup.service';

export function App() {
  useEffect(() => {
    localStorageCleanupService.cleanupObsoleteKeys();
  }, []);

  return (
    <AppProviders>
      <AppAuthBootstrap />
      <AppUpdateBanner />
      <AppRealtimeSync />
      <RouterProvider router={router} />
    </AppProviders>
  );
}
