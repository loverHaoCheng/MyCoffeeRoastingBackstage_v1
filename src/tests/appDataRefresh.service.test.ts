import { type QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { refreshQuickAppData, resolveCurrentAppRefreshScope } from '@/app/services/appDataRefresh.service';
import { beanQueryKeys } from '@/modules/bean/hooks';
import { beanService } from '@/modules/bean/services/bean.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import { financeQueryKeys } from '@/modules/finance/hooks';
import { roastBatchQueryKeys } from '@/modules/roast/hooks/useRoastBatches';
import { roastPlanQueryKeys } from '@/modules/roast/hooks/useRoastPlans';
import { appDisplaySettingsService } from '@/modules/settings/services/appDisplaySettings.service';
import { appDisplaySettingsSyncService } from '@/modules/settings/services/appDisplaySettingsSync.service';
import { costTemplateSettingsService } from '@/modules/settings/services/costTemplateSettings.service';
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

    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = {
      invalidateQueries,
    } as unknown as QueryClient;

    const pendingOpsSpy = vi.spyOn(beanSyncService, 'getPendingOperations').mockReturnValue([]);
    const pendingSyncSpy = vi.spyOn(beanService, 'syncPendingOperations');
    const costTemplateSyncSpy = vi
      .spyOn(costTemplateSyncService, 'syncSafely')
      .mockResolvedValue(costTemplateSettingsService.load());
    const appDisplaySyncSpy = vi
      .spyOn(appDisplaySettingsSyncService, 'syncSafely')
      .mockResolvedValue(appDisplaySettingsService.load());
    vi.spyOn(localStorageCleanupService, 'cleanupObsoleteKeys').mockReturnValue([]);

    const result = await refreshQuickAppData(queryClient);

    expect(result).toEqual({
      downloaded: 0,
      failed: 0,
      success: 0,
      uploaded: 0,
    });
    expect(pendingOpsSpy).toHaveBeenCalledTimes(1);
    expect(pendingSyncSpy).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: beanQueryKeys.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: roastPlanQueryKeys.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: roastBatchQueryKeys.all });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: financeQueryKeys.all });
    expect(costTemplateSyncSpy).not.toHaveBeenCalled();
    expect(appDisplaySyncSpy).not.toHaveBeenCalled();
  });
});
