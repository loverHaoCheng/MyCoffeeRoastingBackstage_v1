import type { QueryClient } from '@tanstack/react-query';

import { beanEditableDetailQueryKeys, beanQueryKeys } from '@/modules/bean/hooks';
import { beanService } from '@/modules/bean/services/bean.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import { financeQueryKeys } from '@/modules/finance/hooks';
import { financeService } from '@/modules/finance/services';
import { roastBatchQueryKeys } from '@/modules/roast/hooks/useRoastBatches';
import { roastPlanQueryKeys } from '@/modules/roast/hooks/useRoastPlans';
import { roastBatchService } from '@/modules/roast/services/roastBatch.service';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { type AppRouteKey } from '@/router/navigation';
import { appDisplaySettingsSyncService } from '@/modules/settings/services/appDisplaySettingsSync.service';
import { costTemplateSyncService } from '@/modules/settings/services/costTemplateSync.service';
import { useSettingsStore } from '@/modules/settings/store';
import { localStorageCleanupService } from '@/shared/services/localStorageCleanup.service';
import { logger } from '@/shared/logger/logger';

export interface AppDataRefreshResult {
  downloaded: number;
  failed: number;
  success: number;
  uploaded: number;
}

export type AppRefreshScope = AppRouteKey | 'all';

type SettingsSyncState = ReturnType<typeof useSettingsStore.getState>;

const quickRefreshQueryKeysByScope: Record<AppRefreshScope, readonly (readonly unknown[])[]> = {
  all: [
    beanQueryKeys.all,
    beanEditableDetailQueryKeys.all,
    roastPlanQueryKeys.all,
    roastBatchQueryKeys.all,
    financeQueryKeys.all,
  ],
  bean: [beanQueryKeys.all],
  production: [beanQueryKeys.all, roastBatchQueryKeys.all],
  roast: [beanQueryKeys.all, roastPlanQueryKeys.all, roastBatchQueryKeys.all],
  settings: [beanQueryKeys.all],
};

let deferredSettingsSyncPromise: null | Promise<void> = null;

const getCurrentPathname = (): string => {
  if (typeof window === 'undefined') {
    return '/';
  }

  const hashPath = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';

  return hashPath.length > 0 ? hashPath : window.location.pathname || '/';
};

const getScopeFromPathname = (pathname: string): AppRefreshScope => {
  if (pathname.startsWith('/roasts')) {
    return 'roast';
  }

  if (pathname.startsWith('/production')) {
    return 'production';
  }

  if (pathname.startsWith('/settings')) {
    return 'settings';
  }

  if (pathname.startsWith('/beans')) {
    return 'bean';
  }

  return 'bean';
};

export const resolveCurrentAppRefreshScope = (): AppRefreshScope => {
  return getScopeFromPathname(getCurrentPathname());
};

const scheduleDeferredSettingsSync = (settingsState: SettingsSyncState): Promise<void> => {
  if (deferredSettingsSyncPromise != null) {
    return deferredSettingsSyncPromise;
  }

  deferredSettingsSyncPromise = new Promise<void>((resolve) => {
    const runDeferredSync = () => {
      void (async () => {
        try {
          await costTemplateSyncService.syncSafely(settingsState.costTemplateSettings);
          await appDisplaySettingsSyncService.syncSafely(settingsState.appDisplaySettings);
          settingsState.loadCostTemplates();
          settingsState.loadAppDisplaySettings();
        } catch (error) {
          logger.warn('deferred app settings sync failed', { error });
        } finally {
          deferredSettingsSyncPromise = null;
          resolve();
        }
      })();
    };

    if (typeof window === 'undefined') {
      runDeferredSync();
      return;
    }

    globalThis.setTimeout(runDeferredSync, 900);
  });

  return deferredSettingsSyncPromise;
};

const syncSharedAppSettings = async (options: { deferNonCriticalSync?: boolean } = {}) => {
  localStorageCleanupService.cleanupObsoleteKeys();

  const settingsState = useSettingsStore.getState();

  settingsState.loadSupabaseConnections();
  settingsState.loadCostTemplates();
  settingsState.loadAppDisplaySettings();

  const pendingOperations = beanSyncService.getPendingOperations();
  const pendingResult =
    pendingOperations.length > 0
      ? await beanService.syncPendingOperations().catch(() => ({ failed: 0, success: 0 }))
      : { failed: 0, success: 0 };

  if (options.deferNonCriticalSync) {
    void scheduleDeferredSettingsSync(settingsState);
  } else {
    await costTemplateSyncService.syncSafely(settingsState.costTemplateSettings);
    await appDisplaySettingsSyncService.syncSafely(settingsState.appDisplaySettings);
    settingsState.loadCostTemplates();
    settingsState.loadAppDisplaySettings();
  }

  return pendingResult;
};

const refreshAppQueryCaches = async (
  queryClient: QueryClient,
  scope: AppRefreshScope,
): Promise<void> => {
  const targetQueryKeys = quickRefreshQueryKeysByScope[scope];

  await Promise.all(
    targetQueryKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
};

export const refreshQuickAppData = async (
  queryClient: QueryClient,
  scope: AppRefreshScope = resolveCurrentAppRefreshScope(),
): Promise<AppDataRefreshResult> => {
  const pendingResult = await syncSharedAppSettings({ deferNonCriticalSync: true });
  await refreshAppQueryCaches(queryClient, scope);

  return {
    downloaded: 0,
    failed: pendingResult.failed,
    success: pendingResult.success,
    uploaded: 0,
  };
};

export const refreshAllAppData = async (queryClient: QueryClient): Promise<AppDataRefreshResult> => {
  const pendingResult = await syncSharedAppSettings();
  const syncResults = await Promise.allSettled([
    beanService.syncLocalAndRemote(),
    roastPlanService.syncLocalAndRemote(),
    roastBatchService.syncLocalAndRemote(),
    financeService.syncLocalAndRemote(),
  ]);

  const beanSync = syncResults[0];
  const roastPlanSync = syncResults[1];
  const roastBatchSync = syncResults[2];
  const financeSync = syncResults[3];

  await refreshAppQueryCaches(queryClient, 'all');

  return {
    downloaded:
      (beanSync.status === 'fulfilled' ? beanSync.value.downloaded : 0) +
      (roastPlanSync.status === 'fulfilled' ? roastPlanSync.value.downloaded : 0) +
      (roastBatchSync.status === 'fulfilled' ? roastBatchSync.value.downloaded : 0) +
      (financeSync.status === 'fulfilled' ? financeSync.value.downloaded : 0),
    failed:
      pendingResult.failed +
      syncResults.filter((result) => result.status === 'rejected').length,
    success: pendingResult.success,
    uploaded:
      (beanSync.status === 'fulfilled' ? beanSync.value.uploaded : 0) +
      (roastPlanSync.status === 'fulfilled' ? roastPlanSync.value.uploaded : 0) +
      (roastBatchSync.status === 'fulfilled' ? roastBatchSync.value.uploaded : 0) +
      (financeSync.status === 'fulfilled' ? financeSync.value.uploaded : 0),
  };
};
