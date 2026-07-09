import { beforeEach, describe, expect, it, vi } from 'vitest';

import { roastBatchService } from '@/modules/roast/services/roastBatch.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

describe('roastBatchService', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    pocketBaseConnectionSettingsService.clear();
    pocketBaseConnectionSettingsService.save({
      ...createDefaultPocketBaseConnectionSettings(),
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T18:00:00.000Z',
    });
    vi.restoreAllMocks();
  });

  it('falls back to roast_batches when roast_batch_overview misses sales_mode', async () => {
    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation((collectionName) => {
      if (collectionName === 'roast_batch_overview') {
        return Promise.resolve([{
          created_at: '2026-07-09T10:00:00.000Z',
          development_ratio: 18,
          first_crack_time: 420,
          green_bean_id: 'bean-1',
          green_bean_name: '测试生豆',
          id: 'batch-1',
          input_weight_grams: 200,
          notes: 'overview missing sales mode',
          output_weight_grams: 170,
          roast_date: '2026-07-09T10:00:00.000Z',
          roast_level: '浅烘',
          status: 'completed',
          total_roast_time: 540,
          updated_at: '2026-07-09T10:00:00.000Z',
        }]);
      }

      return Promise.resolve([{
        created_at: '2026-07-09T10:00:00.000Z',
        development_ratio: 18,
        first_crack_time: 420,
        green_bean_id: 'bean-1',
        green_bean_name: '测试生豆',
        id: 'batch-1',
        input_weight_grams: 200,
        notes: 'table row with self use',
        output_weight_grams: 170,
        roast_date: '2026-07-09T10:00:00.000Z',
        roast_level: '浅烘',
        sales_mode: 'selfUse',
        status: 'completed',
        total_roast_time: 540,
        updated_at: '2026-07-09T10:00:00.000Z',
      }]);
    });

    await expect(roastBatchService.listBatches()).resolves.toMatchObject({
      code: 0,
      data: [{
        id: 'batch-1',
        salesMode: 'selfUse',
      }],
      message: 'ok',
    });

    expect(listSpy).toHaveBeenNthCalledWith(1, 'roast_batch_overview', {
      orderBy: { ascending: false, column: 'roast_date' },
    });
    expect(listSpy).toHaveBeenNthCalledWith(2, 'roast_batches', {
      orderBy: { ascending: false, column: 'roast_date' },
    });
  });
});
