import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { AppUpdateBanner } from '@/app/components/AppUpdateBanner';
import { AppProviders } from '@/app/providers/AppProviders';
import { router } from '@/router/routes';
import { localStorageCleanupService } from '@/shared/services/localStorageCleanup.service';

const preloadApplicationModules = () => {
  void import('@/modules/auth');
  void import('@/modules/bean');
  void import('@/modules/production');
  void import('@/modules/roast');
  void import('@/modules/settings');
};

export function App() {
  useEffect(() => {
    localStorageCleanupService.cleanupObsoleteKeys();

    if (typeof globalThis.window === 'undefined') {
      return;
    }

    if ('requestIdleCallback' in globalThis.window) {
      const idleCallbackId = globalThis.window.requestIdleCallback(() => {
        preloadApplicationModules();
      }, { timeout: 1200 });

      return () => {
        globalThis.window.cancelIdleCallback(idleCallbackId);
      };
    }

    const timeoutId = globalThis.setTimeout(() => {
      preloadApplicationModules();
    }, 700);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <AppProviders>
      <AppUpdateBanner />
      <RouterProvider router={router} />
    </AppProviders>
  );
}
