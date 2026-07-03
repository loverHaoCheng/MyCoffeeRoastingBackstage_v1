import type { QueryClient } from '@tanstack/react-query';

import { beanEditableDetailQueryKeys, beanQueryKeys } from '@/modules/bean/hooks';
import { beanService } from '@/modules/bean/services/bean.service';
import { financeQueryKeys } from '@/modules/finance/hooks';
import { financeService } from '@/modules/finance/services';
import { roastBatchQueryKeys } from '@/modules/roast/hooks/useRoastBatches';
import { roastPlanQueryKeys } from '@/modules/roast/hooks/useRoastPlans';
import { roastBatchService } from '@/modules/roast/services/roastBatch.service';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { appDisplaySettingsSyncService } from '@/modules/settings/services/appDisplaySettingsSync.service';
import { costTemplateSyncService } from '@/modules/settings/services/costTemplateSync.service';
import { useSettingsStore } from '@/modules/settings/store';
import { localStorageCleanupService } from '@/shared/services/localStorageCleanup.service';

export interface AppDataRefreshResult {
  downloaded: number;
  failed: number;
  success: number;
  uploaded: number;
}

export const refreshAllAppData = async (queryClient: QueryClient): Promise<AppDataRefreshResult> => {
  localStorageCleanupService.cleanupObsoleteKeys();

  const settingsState = useSettingsStore.getState();

  settingsState.loadSupabaseConnections();
  settingsState.loadCostTemplates();
  settingsState.loadAppDisplaySettings();

  const pendingResult = await beanService.syncPendingOperations().catch(() => ({ failed: 0, success: 0 }));
  await costTemplateSyncService.syncSafely(settingsState.costTemplateSettings);
  await appDisplaySettingsSyncService.syncSafely(settingsState.appDisplaySettings);
  settingsState.loadCostTemplates();
  settingsState.loadAppDisplaySettings();
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

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: beanQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: beanEditableDetailQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: roastPlanQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: roastBatchQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: financeQueryKeys.all }),
  ]);

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
