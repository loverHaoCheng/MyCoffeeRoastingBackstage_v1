import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { AppRealtimeSync } from '@/app/components/AppRealtimeSync';
import { AppStartupSync } from '@/app/components/AppStartupSync';
import { AppAiAnalysisTaskNotifications } from '@/app/components/AppAiAnalysisTaskNotifications';
import { AppAuthBootstrap } from '@/app/components/AppAuthBootstrap';
import { AppEnvironmentGuidance } from '@/app/components/AppEnvironmentGuidance';
import { AppRoastedBeanConnectionProbe } from '@/app/components/AppRoastedBeanConnectionProbe';
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
      <AppAiAnalysisTaskNotifications />
      <AppRoastedBeanConnectionProbe />
      <AppEnvironmentGuidance />
      <AppUpdateBanner />
      <AppRealtimeSync />
      <AppStartupSync />
      <RouterProvider router={router} />
    </AppProviders>
  );
}
