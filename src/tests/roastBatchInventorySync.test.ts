import { beforeEach, describe, expect, it } from 'vitest';

import { localGreenBeanStorageKey } from '@/modules/bean/services';
import { roastBatchService } from '@/modules/roast/services/roastBatch.service';

const readRemainingWeight = (): number => {
  const raw = window.localStorage.getItem(localGreenBeanStorageKey);

  expect(raw).not.toBeNull();

  const parsed = JSON.parse(raw ?? '{}') as {
    records: { remainingWeightGrams?: number }[];
  };

  return parsed.records[0]?.remainingWeightGrams ?? 0;
};

describe('roastBatchService inventory sync', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      localGreenBeanStorageKey,
      JSON.stringify({
        records: [
          {
            id: 'local-bean-1',
            source: 'local',
            code: 'GB-LOCAL-001',
            defaultRoastInputGrams: 200,
            defaultSaleUnitPrice: 88,
            defaultSaleUnitWeightGrams: 100,
            displayName: '测试生豆',
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
            variety: '74110',
            altitudeMetersMax: null,
            altitudeMetersMin: null,
            densityGPerL: null,
            moisturePercent: null,
            createdAt: '2026-07-03T00:00:00.000Z',
            updatedAt: '2026-07-03T00:00:00.000Z',
          },
        ],
        version: 1,
      }),
    );
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
