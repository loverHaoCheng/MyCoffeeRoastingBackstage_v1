import type { QueryClient } from '@tanstack/react-query';

import { beanEditableDetailQueryKeys, beanQueryKeys } from '@/modules/bean/hooks';
import { beanService } from '@/modules/bean/services/bean.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import { financeQueryKeys } from '@/modules/finance/hooks';
import { financeLedgerService, financeService } from '@/modules/finance/services';
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
  failedDetails: string[];
  success: number;
  uploaded: number;
}

export type AppRefreshScope = AppRouteKey | 'all';

type SettingsSyncState = ReturnType<typeof useSettingsStore.getState>;

interface NamedSyncJob {
  label: string;
  promise: Promise<{ downloaded: number; uploaded: number }>;
}

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

  if (pathname.startsWith('/finance')) {
    return 'finance';
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
          await settingsState.loadPocketBaseConnections({ forceRemote: true });
          await costTemplateSyncService.syncFromRemoteSafely();
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

  await settingsState.loadPocketBaseConnections({ forceRemote: true });
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
    await costTemplateSyncService.syncFromRemoteSafely();
    await appDisplaySettingsSyncService.syncSafely(settingsState.appDisplaySettings);
    settingsState.loadCostTemplates();
    settingsState.loadAppDisplaySettings();
  }

  return pendingResult;
};

const getSyncJobsForScope = (scope: AppRefreshScope): NamedSyncJob[] => {
  if (scope === 'all') {
    return [
      { label: '生豆', promise: beanService.syncLocalAndRemote() },
      { label: '烘焙计划', promise: roastPlanService.syncLocalAndRemote() },
      { label: '烘焙记录', promise: roastBatchService.syncLocalAndRemote() },
      { label: '成本核算', promise: financeService.syncLocalAndRemote() },
      { label: '财务台账', promise: financeLedgerService.syncLocalAndRemote() },
    ];
  }

  if (scope === 'bean') {
    return [{ label: '生豆', promise: beanService.syncLocalAndRemote() }];
  }

  if (scope === 'production') {
    return [
      { label: '生豆', promise: beanService.syncLocalAndRemote() },
      { label: '烘焙记录', promise: roastBatchService.syncLocalAndRemote() },
    ];
  }

  if (scope === 'finance') {
    return [
      { label: '生豆', promise: beanService.syncLocalAndRemote() },
      { label: '成本核算', promise: financeService.syncLocalAndRemote() },
      { label: '财务台账', promise: financeLedgerService.syncLocalAndRemote() },
    ];
  }

  if (scope === 'roast') {
    return [
      { label: '生豆', promise: beanService.syncLocalAndRemote() },
      { label: '烘焙计划', promise: roastPlanService.syncLocalAndRemote() },
      { label: '烘焙记录', promise: roastBatchService.syncLocalAndRemote() },
    ];
  }

  return [];
};

const hydrateAppQueryCaches = (queryClient: QueryClient, scope: AppRefreshScope): void => {
  if (scope === 'all' || scope === 'bean' || scope === 'production' || scope === 'roast') {
    queryClient.setQueryData(beanQueryKeys.list(), beanService.getBootstrappedBeans());
  }

  if (scope === 'finance') {
    queryClient.setQueryData(beanQueryKeys.list(), beanService.getBootstrappedBeans());
  }

  if (scope === 'all' || scope === 'roast') {
    queryClient.setQueryData(roastPlanQueryKeys.list(), roastPlanService.getBootstrappedPlans());
  }

  if (scope === 'all' || scope === 'production' || scope === 'roast') {
    queryClient.setQueryData(roastBatchQueryKeys.list(), roastBatchService.getBootstrappedBatches());
  }

  if (scope === 'all' || scope === 'finance') {
    queryClient.setQueryData(financeQueryKeys.calculations(), financeService.getBootstrappedCalculations());
    queryClient.setQueryData(financeQueryKeys.expenses(), financeLedgerService.getBootstrappedExpenseRecords());
  }

  if (scope === 'all' || scope === 'bean') {
    queryClient.removeQueries({ queryKey: beanEditableDetailQueryKeys.all, type: 'inactive' });
  }
};

const buildRefreshResult = (
  pendingResult: { failed: number; success: number },
  namedSyncResults: {
    label: string;
    result: PromiseSettledResult<{ downloaded: number; uploaded: number }>;
  }[],
): AppDataRefreshResult => {
  const failedDetails = [
    ...(pendingResult.failed > 0 ? ['待同步操作同步失败'] : []),
    ...namedSyncResults.flatMap((item) => {
      if (item.result.status !== 'rejected') {
        return [];
      }

      return [getSyncFailureDetail(item.label, item.result)];
    }),
  ];

  return {
    downloaded: namedSyncResults.reduce(
      (total, item) => total + (item.result.status === 'fulfilled' ? item.result.value.downloaded : 0),
      0,
    ),
    failed: failedDetails.length,
    failedDetails,
    success: pendingResult.success,
    uploaded: namedSyncResults.reduce(
      (total, item) => total + (item.result.status === 'fulfilled' ? item.result.value.uploaded : 0),
      0,
    ),
  };
};

const getSyncFailureDetail = (label: string, result: PromiseRejectedResult): string => {
  if (result.reason instanceof Error && result.reason.message.trim().length > 0) {
    return `${label}同步失败：${result.reason.message}`;
  }

  return `${label}同步失败`;
};

export const refreshQuickAppData = async (
  queryClient: QueryClient,
  scope: AppRefreshScope = resolveCurrentAppRefreshScope(),
): Promise<AppDataRefreshResult> => {
  const pendingResult = await syncSharedAppSettings();
  const syncJobs = getSyncJobsForScope(scope);
  const syncResults = await Promise.allSettled(syncJobs.map((job) => job.promise));
  const namedSyncResults = syncJobs.map((job, index) => ({
    label: job.label,
    result: syncResults[index] as PromiseSettledResult<{ downloaded: number; uploaded: number }>,
  }));

  hydrateAppQueryCaches(queryClient, scope);

  return buildRefreshResult(pendingResult, namedSyncResults);
};

export const refreshAllAppData = async (queryClient: QueryClient): Promise<AppDataRefreshResult> => {
  const pendingResult = await syncSharedAppSettings();
  const syncJobs = getSyncJobsForScope('all');
  const syncResults = await Promise.allSettled(syncJobs.map((job) => job.promise));
  const namedSyncResults = syncJobs.map((job, index) => ({
    label: job.label,
    result: syncResults[index] as PromiseSettledResult<{ downloaded: number; uploaded: number }>,
  }));

  hydrateAppQueryCaches(queryClient, 'all');

  return buildRefreshResult(pendingResult, namedSyncResults);
};
