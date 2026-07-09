import { type QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { refreshAllAppData, refreshQuickAppData, resolveCurrentAppRefreshScope } from '@/app/services/appDataRefresh.service';
import { beanQueryKeys } from '@/modules/bean/hooks';
import { beanService } from '@/modules/bean/services/bean.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import { financeQueryKeys } from '@/modules/finance/hooks';
import { financeLedgerService, financeService } from '@/modules/finance/services';
import { roastBatchQueryKeys } from '@/modules/roast/hooks/useRoastBatches';
import { roastPlanQueryKeys } from '@/modules/roast/hooks/useRoastPlans';
import { roastBatchService } from '@/modules/roast/services/roastBatch.service';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { appDisplaySettingsService } from '@/modules/settings/services/appDisplaySettings.service';
import { appDisplaySettingsSyncService } from '@/modules/settings/services/appDisplaySettingsSync.service';
import { costTemplateSyncService } from '@/modules/settings/services/costTemplateSync.service';
import { localStorageCleanupService } from '@/shared/services/localStorageCleanup.service';

describe('appDataRefresh.service', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('maps the current hash route to the matching refresh scope', () => {
    window.location.hash = '#/production';

    expect(resolveCurrentAppRefreshScope()).toBe('production');
  });

  it('skips pending sync and only refreshes the active roast page queries during quick refresh', async () => {
    window.location.hash = '#/roasts';
    vi.useFakeTimers();

    const setQueryData = vi.fn();
    const removeQueries = vi.fn();
    const queryClient = {
      removeQueries,
      setQueryData,
    } as unknown as QueryClient;

    const pendingOpsSpy = vi.spyOn(beanSyncService, 'getPendingOperations').mockReturnValue([]);
    const pendingSyncSpy = vi.spyOn(beanService, 'syncPendingOperations');
    const beanSyncSpy = vi.spyOn(beanService, 'syncLocalAndRemote').mockResolvedValue({ downloaded: 1, uploaded: 0 });
    const roastPlanSyncSpy = vi.spyOn(roastPlanService, 'syncLocalAndRemote').mockResolvedValue({ downloaded: 2, uploaded: 1 });
    const roastBatchSyncSpy = vi.spyOn(roastBatchService, 'syncLocalAndRemote').mockResolvedValue({ downloaded: 0, uploaded: 0 });
    const financeSyncSpy = vi.spyOn(financeService, 'syncLocalAndRemote');
    const costTemplateSyncSpy = vi
      .spyOn(costTemplateSyncService, 'syncFromRemoteSafely')
      .mockResolvedValue({
        defaultTemplateId: null,
        templates: [],
        updatedAt: null,
      });
    const appDisplaySyncSpy = vi
      .spyOn(appDisplaySettingsSyncService, 'syncSafely')
      .mockResolvedValue(appDisplaySettingsService.load());
    vi.spyOn(localStorageCleanupService, 'cleanupObsoleteKeys').mockReturnValue([]);

    const result = await refreshQuickAppData(queryClient);

    expect(result).toEqual({
      downloaded: 3,
      failed: 0,
      failedDetails: [],
      success: 0,
      uploaded: 1,
    });
    expect(pendingOpsSpy).toHaveBeenCalledTimes(1);
    expect(pendingSyncSpy).not.toHaveBeenCalled();
    expect(beanSyncSpy).toHaveBeenCalledTimes(1);
    expect(roastPlanSyncSpy).toHaveBeenCalledTimes(1);
    expect(roastBatchSyncSpy).toHaveBeenCalledTimes(1);
    expect(financeSyncSpy).not.toHaveBeenCalled();
    expect(setQueryData).toHaveBeenCalledWith(beanQueryKeys.list(), beanService.getBootstrappedBeans());
    expect(setQueryData).toHaveBeenCalledWith(roastPlanQueryKeys.list(), roastPlanService.getBootstrappedPlans());
    expect(setQueryData).toHaveBeenCalledWith(roastBatchQueryKeys.list(), roastBatchService.getBootstrappedBatches());
    expect(costTemplateSyncSpy).toHaveBeenCalledTimes(1);
    expect(appDisplaySyncSpy).toHaveBeenCalledTimes(1);
  });

  it('returns failed sync module details for full refresh', async () => {
    window.location.hash = '#/settings';

    const setQueryData = vi.fn();
    const removeQueries = vi.fn();
    const queryClient = {
      removeQueries,
      setQueryData,
    } as unknown as QueryClient;

    vi.spyOn(beanSyncService, 'getPendingOperations').mockReturnValue([]);
    vi.spyOn(beanService, 'syncLocalAndRemote').mockResolvedValue({ downloaded: 1, uploaded: 2 });
    vi.spyOn(roastPlanService, 'syncLocalAndRemote').mockResolvedValue({ downloaded: 0, uploaded: 0 });
    vi.spyOn(roastBatchService, 'syncLocalAndRemote').mockRejectedValue(new Error('熟豆库表结构不匹配'));
    vi.spyOn(financeService, 'syncLocalAndRemote').mockResolvedValue({ downloaded: 0, uploaded: 0 });
    vi.spyOn(financeLedgerService, 'syncLocalAndRemote').mockResolvedValue({ downloaded: 0, uploaded: 0 });
    vi.spyOn(costTemplateSyncService, 'syncFromRemoteSafely').mockResolvedValue({
      defaultTemplateId: null,
      templates: [],
      updatedAt: null,
    });
    vi.spyOn(appDisplaySettingsSyncService, 'syncSafely').mockResolvedValue(appDisplaySettingsService.load());
    vi.spyOn(localStorageCleanupService, 'cleanupObsoleteKeys').mockReturnValue([]);

    const result = await refreshAllAppData(queryClient);

    expect(result.failed).toBe(1);
    expect(result.failedDetails[0]).toContain('烘焙记录同步失败');
    expect(result.failedDetails[0]).toContain('熟豆库表结构不匹配');
    expect(setQueryData).toHaveBeenCalledWith(beanQueryKeys.list(), beanService.getBootstrappedBeans());
    expect(setQueryData).toHaveBeenCalledWith(roastPlanQueryKeys.list(), roastPlanService.getBootstrappedPlans());
    expect(setQueryData).toHaveBeenCalledWith(roastBatchQueryKeys.list(), roastBatchService.getBootstrappedBatches());
    expect(setQueryData).toHaveBeenCalledWith(financeQueryKeys.calculations(), financeService.getBootstrappedCalculations());
  });
});
