import { beforeEach, describe, expect, it } from 'vitest';

import { beanService } from '@/modules/bean/services/bean.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';

const createInput = () => ({
  altitudeMetersMax: null,
  altitudeMetersMin: null,
  code: 'GB-FALLBACK-001',
  costTemplateId: null,
  defaultRoastInputGrams: 200,
  defaultSaleUnitPrice: 0,
  defaultSaleUnitWeightGrams: null,
  densityGPerL: null,
  displayName: '本地回退测试豆',
  grade: 'G1',
  harvestSeason: '2025/26',
  millName: '',
  moisturePercent: null,
  notes: '',
  originArea: '',
  originCountry: '埃塞俄比亚',
  originRegion: '古吉',
  processMethod: '水洗',
  purchasedTotalPrice: 0,
  purchasedWeightGrams: 1000,
  remainingWeightGrams: 1000,
  supplierName: '',
  variety: '74110',
});

describe('beanService create fallback', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps the optimistic bean locally and queues a pending create operation', () => {
    const input = createInput();

    const optimisticBean = beanService.createOptimisticBean(input);
    const nextBeans = beanService.persistOptimisticBeanAsPending(input);

    expect(nextBeans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: optimisticBean.code,
          id: optimisticBean.id,
          name: optimisticBean.name,
        }),
      ]),
    );
    expect(beanSyncService.getPendingOperations()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'bean',
          type: 'create',
        }),
      ]),
    );
  });
});
