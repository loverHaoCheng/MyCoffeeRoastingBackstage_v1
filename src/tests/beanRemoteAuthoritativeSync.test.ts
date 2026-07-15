import { beforeEach, describe, expect, it, vi } from 'vitest';

import { beanCacheService } from '@/modules/bean/services';
import { beanService } from '@/modules/bean/services/bean.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import { localGreenBeanService } from '@/modules/bean/services/localGreenBean.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

const createInput = () => ({
  agingDays: 14,
  altitudeMetersMax: null,
  altitudeMetersMin: null,
  code: 'GB-REMOTE-001',
  costTemplateId: null,
  defaultRoastInputGrams: 200,
  defaultSaleUnitPrice: 0,
  defaultSaleUnitWeightGrams: null,
  densityGPerL: null,
  displayName: '远端权威测试豆',
  flavorTags: ['柑橘', '花香'],
  grade: 'G1',
  harvestSeason: '2025/26',
  millName: '',
  moisturePercent: null,
  notes: '',
  originArea: '',
  originCountry: '埃塞俄比亚',
  originRegion: '古吉',
  processMethod: '水洗',
  purchaseDate: '2026-07-01',
  purchasedTotalPrice: 0,
  purchasedWeightGrams: 1000,
  remainingWeightGrams: 1000,
  supplierName: '',
  tastingEndDays: 40,
  variety: '74110',
});

describe('bean remote authoritative sync', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    beanCacheService.clear();
    localGreenBeanService.clear();
    pocketBaseConnectionSettingsService.clear();
    pocketBaseConnectionSettingsService.save({
      ...createDefaultPocketBaseConnectionSettings(),
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      updatedAt: '2026-07-13T18:30:00.000Z',
    });
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    vi.restoreAllMocks();
  });

  it('does not keep a stale local bean when PocketBase no longer has it', async () => {
    const optimisticBean = beanService.createOptimisticBean(createInput());

    beanService.rollbackOptimisticBean(String(optimisticBean.id));

    const staleLocalBean = localGreenBeanService.create({
      ...createInput(),
      code: 'GB-STALE-001',
      displayName: '过期本地豆',
    });

    expect(localGreenBeanService.findRecordById(staleLocalBean.id)).not.toBeNull();

    vi.spyOn(beanSyncService, 'isOnline').mockReturnValue(true);
    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockResolvedValue([]);

    await expect(beanService.syncLocalAndRemote()).resolves.toEqual({
      downloaded: 0,
      uploaded: 0,
    });

    expect(listSpy).toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
    expect(localGreenBeanService.findRecordById(staleLocalBean.id)).toBeNull();
    expect(beanService.getBootstrappedBeans()).toEqual([]);
  });

  it('fails fast instead of queuing a local bean when PocketBase is unavailable', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    await expect(beanService.createBean(createInput())).rejects.toMatchObject({
      code: 'NETWORK',
    });

    expect(localGreenBeanService.listRecords()).toEqual([]);
  });
});
