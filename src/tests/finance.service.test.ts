import { beforeEach, describe, expect, it, vi } from 'vitest';

import { financeService } from '@/modules/finance/services';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

describe('financeService', () => {
  beforeEach(() => {
    financeService.clear();
    pocketBaseConnectionSettingsService.clear();
    pocketBaseConnectionSettingsService.save(createDefaultPocketBaseConnectionSettings());
    vi.restoreAllMocks();
  });

  it('keeps finance remote access on the green bean pocketbase even when roasted bean supabase is configured', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: 'https://demo.supabase.co',
        publishableKey: 'sb_publishable_demo',
      },
      updatedAt: '2026-07-08T12:00:00.000Z',
    });

    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);

    await expect(financeService.listCalculations()).resolves.toMatchObject({
      code: 0,
      data: [],
      message: 'ok',
    });

    expect(financeService.getResolvedDataSource()).toBe('greenBean');
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the same-origin business data service even when stored green bean settings are empty', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: '',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-08T12:00:00.000Z',
    });

    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);

    await expect(financeService.listCalculations()).resolves.toMatchObject({
      code: 0,
      data: [],
      message: 'ok',
    });

    expect(financeService.getResolvedDataSource()).toBe('greenBean');
    expect(listSpy).toHaveBeenCalledTimes(1);
  });
});
