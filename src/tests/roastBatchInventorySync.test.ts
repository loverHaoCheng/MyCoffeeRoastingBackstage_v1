import { beforeEach, describe, expect, it } from 'vitest';

import { localGreenBeanService } from '@/modules/bean/services/localGreenBean.service';
import { roastBatchService } from '@/modules/roast/services/roastBatch.service';

const readRemainingWeight = (): number => {
  return localGreenBeanService.findRecordById('local-bean-1')?.remainingWeightGrams ?? 0;
};

describe('roastBatchService inventory sync', () => {
  beforeEach(() => {
    window.localStorage.clear();
    localGreenBeanService.clear();
    localGreenBeanService.restore({
      id: 'local-bean-1',
      source: 'local',
      agingDays: 14,
      code: 'GB-LOCAL-001',
      defaultRoastInputGrams: 200,
      defaultSaleUnitPrice: 88,
      defaultSaleUnitWeightGrams: 100,
      displayName: '测试生豆',
      flavorTags: ['柑橘'],
      harvestSeason: '2026',
      millName: null,
      notes: null,
      originArea: null,
      originCountry: '埃塞俄比亚',
      originRegion: '古吉',
      processMethod: '水洗',
      purchasedTotalPrice: 2100,
      purchasedWeightGrams: 1000,
      remainingWeightGrams: 1000,
      supplierName: '测试供应商',
      tastingEndDays: 40,
      variety: '74110',
      altitudeMetersMax: null,
      altitudeMetersMin: null,
      densityGPerL: null,
      moisturePercent: null,
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z',
    });
  });

  it('deducts and restores remaining weight when roast records change', async () => {
    const created = await roastBatchService.createBatch({
      greenBeanId: 'local-bean-1',
      greenBeanName: '测试生豆',
      inputWeightGrams: 200,
      outputWeightGrams: 172,
      roastDate: '2026-07-03T10:30:00',
      roastLevel: '中焙',
      status: 'completed',
    });

    expect(readRemainingWeight()).toBe(800);

    await roastBatchService.updateBatch(created.data.id, {
      inputWeightGrams: 250,
    });

    expect(readRemainingWeight()).toBe(750);

    await roastBatchService.deleteBatch(created.data.id);

    expect(readRemainingWeight()).toBe(1000);
  });
});
