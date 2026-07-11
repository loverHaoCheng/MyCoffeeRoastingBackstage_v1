import { describe, expect, it } from 'vitest';

import { createGreenBeanInventoryRepository } from '@/modules/bean/services/bean.service';
import { AppError } from '@/shared/errors/AppError';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

describe('createGreenBeanInventoryRepository', () => {
  it('aggregates purchase batches into weighted cost and remaining stock totals', async () => {
    const client = {
      list: <T,>(tableName: string): Promise<T[]> => {
        if (tableName === 'green_beans') {
          return Promise.resolve([
            {
              altitude_meters_max: 0,
              altitude_meters_min: 0,
              code: 'GB-001',
              created_at: '2026-07-03T00:00:00.000Z',
              default_roast_input_grams: 200,
              density_g_per_l: 0,
              display_name: '测试生豆',
              aging_days: 14,
              tasting_end_days: 40,
              flavor_tags: '柑橘,花香',
              harvest_season: '2025/26',
              id: 'bean-1',
              mill_name: null,
              moisture_percent: 0,
              notes: null,
              origin_area: '古吉',
              origin_country: '埃塞俄比亚',
              origin_region: '耶加雪菲',
              process_method: '水洗',
              updated_at: '2026-07-03T00:00:00.000Z',
              variety: '74110',
            } as T,
          ]);
        }

        if (tableName === 'green_bean_purchase_batches') {
          return Promise.resolve([
            {
              created_at: '2026-07-01T00:00:00.000Z',
              green_bean_id: 'bean-1',
              id: 'batch-1',
              purchased_total_price: 500,
              purchased_weight_grams: 5000,
              received_at: '2026-07-01',
              remaining_weight_grams: 2000,
              supplier_name: '供应商 A',
              updated_at: '2026-07-01T00:00:00.000Z',
            } as T,
            {
              created_at: '2026-07-05T00:00:00.000Z',
              green_bean_id: 'bean-1',
              id: 'batch-2',
              purchased_total_price: 1500,
              purchased_weight_grams: 5000,
              received_at: '2026-07-05',
              remaining_weight_grams: 4000,
              supplier_name: '供应商 B',
              updated_at: '2026-07-05T00:00:00.000Z',
            } as T,
          ]);
        }

        if (tableName === 'bean_sale_specs') {
          return Promise.resolve([
            {
              created_at: '2026-07-02T00:00:00.000Z',
              green_bean_id: 'bean-1',
              id: 'sale-1',
              is_default: true,
              unit_price: 48,
              unit_weight_grams: 250,
              updated_at: '2026-07-02T00:00:00.000Z',
            } as T,
          ]);
        }

        if (tableName === 'app_settings') {
          return Promise.resolve([
            {
              id: 'setting-1',
              key: 'green_bean_grade:bean-1',
              updated_at: '2026-07-06T00:00:00.000Z',
              value: {
                grade: 'SHB',
                updatedAt: '2026-07-06T00:00:00.000Z',
              },
            } as T,
          ]);
        }

        return Promise.resolve([]);
      },
    } as unknown as PocketBaseRestClient;

    const repository = createGreenBeanInventoryRepository(client);
    const result = await repository.listBeans();

    expect(result.data).toEqual([
      expect.objectContaining({
        costPerKg: 200,
        defaultSaleUnitPrice: 48,
        defaultSaleUnitWeightGrams: 250,
        altitudeMetersMax: null,
        altitudeMetersMin: null,
        densityGPerL: null,
        grade: 'SHB',
        id: 'bean-1',
        moisturePercent: null,
        stockKg: 6,
        supplierName: '供应商 B',
      }),
    ]);
  });

  it('writes grade into the green bean table while keeping app settings compatibility', async () => {
    const updateCalls: { payload: Record<string, unknown>; tableName: string }[] = [];
    const insertCalls: { payload: Record<string, unknown>; tableName: string }[] = [];
    const client = {
      insert: <T,>(tableName: string, payload: Record<string, unknown>): Promise<T[]> => {
        insertCalls.push({ payload, tableName });
        return Promise.resolve([] as T[]);
      },
      list: <T,>(tableName: string): Promise<T[]> => {
        if (tableName === 'green_beans') {
          return Promise.resolve([
            {
              altitude_meters_max: null,
              altitude_meters_min: null,
              code: 'GB-001',
              created_at: '2026-07-03T00:00:00.000Z',
              default_roast_input_grams: 200,
              density_g_per_l: null,
              display_name: '测试生豆',
              aging_days: 14,
              tasting_end_days: 40,
              flavor_tags: '柑橘,花香',
              grade: null,
              harvest_season: '2025/26',
              id: 'bean-1',
              mill_name: null,
              moisture_percent: null,
              notes: null,
              origin_area: '古吉',
              origin_country: '埃塞俄比亚',
              origin_region: '耶加雪菲',
              process_method: '水洗',
              updated_at: '2026-07-03T00:00:00.000Z',
              variety: '74110',
            } as T,
          ]);
        }

        if (tableName === 'green_bean_purchase_batches') {
          return Promise.resolve([
            {
              created_at: '2026-07-01T00:00:00.000Z',
              green_bean_id: 'bean-1',
              id: 'batch-1',
              purchased_total_price: 500,
              purchased_weight_grams: 5000,
              received_at: '2026-07-01',
              remaining_weight_grams: 2000,
              supplier_name: '供应商 A',
              updated_at: '2026-07-01T00:00:00.000Z',
            } as T,
          ]);
        }

        if (tableName === 'bean_sale_specs' || tableName === 'roast_batches') {
          return Promise.resolve([]);
        }

        if (tableName === 'app_settings') {
          return Promise.resolve([] as T[]);
        }

        return Promise.resolve([]);
      },
      update: <T,>(
        tableName: string,
        payload: Record<string, unknown>,
      ): Promise<T[]> => {
        updateCalls.push({ payload, tableName });

        if (tableName === 'green_beans') {
          return Promise.resolve([{ id: 'bean-1' } as T]);
        }

        return Promise.resolve([] as T[]);
      },
    } as unknown as PocketBaseRestClient;

    const repository = createGreenBeanInventoryRepository(client);

    await repository.updateBean('bean-1', {
      agingDays: 14,
      altitudeMetersMax: null,
      altitudeMetersMin: null,
      code: 'GB-001',
      defaultRoastInputGrams: 200,
      defaultSaleUnitPrice: 48,
      defaultSaleUnitWeightGrams: 250,
      densityGPerL: null,
      displayName: '测试生豆',
      flavorTags: ['柑橘', '花香'],
      grade: 'SHB',
      harvestSeason: '2025/26',
      millName: '',
      moisturePercent: null,
      notes: '',
      originArea: '古吉',
      originCountry: '埃塞俄比亚',
      originRegion: '耶加雪菲',
      processMethod: '水洗',
      purchaseDate: '2026-07-01',
      purchasedTotalPrice: 500,
      purchasedWeightGrams: 5000,
      remainingWeightGrams: 2000,
      supplierName: '供应商 A',
      tastingEndDays: 40,
      variety: '74110',
    });

    const greenBeanUpdateCall = updateCalls.find((item) => item.tableName === 'green_beans');
    const gradeInsertCall = insertCalls.find((item) => item.tableName === 'app_settings');

    expect(greenBeanUpdateCall?.payload).toHaveProperty('grade', 'SHB');
    expect(gradeInsertCall?.payload.key).toBe('green_bean_grade:bean-1');
    expect(gradeInsertCall?.payload.value).toEqual(
      expect.objectContaining({
        grade: 'SHB',
      }),
    );
  });

  it('removes roast batches before deleting the green bean record', async () => {
    const deleteCalls: { match: Record<string, unknown>; tableName: string }[] = [];
    const client = {
      delete: (tableName: string, options: { match: Record<string, unknown> }) => {
        deleteCalls.push({ match: options.match, tableName });
        return Promise.resolve();
      },
      insert: <T,>(): Promise<T[]> => {
        return Promise.resolve([] as T[]);
      },
      list: <T,>(): Promise<T[]> => {
        return Promise.resolve([] as T[]);
      },
      update: <T,>(): Promise<T[]> => {
        return Promise.resolve([] as T[]);
      },
    } as unknown as PocketBaseRestClient;

    const repository = createGreenBeanInventoryRepository(client);

    await repository.deleteBean('bean-1');

    expect(deleteCalls).toEqual([
      { match: { green_bean_id: 'bean-1' }, tableName: 'roast_batches' },
      { match: { green_bean_id: 'bean-1' }, tableName: 'green_bean_purchase_batches' },
      { match: { green_bean_id: 'bean-1' }, tableName: 'roast_records' },
      { match: { green_bean_id: 'bean-1' }, tableName: 'roast_profiles' },
      { match: { green_bean_id: 'bean-1' }, tableName: 'bean_sale_specs' },
      { match: { id: 'bean-1' }, tableName: 'green_beans' },
    ]);
  });

  it('creates beans successfully when optional bean settings collections are unavailable', async () => {
    const missingOptionalCollectionError = new AppError('PocketBase 记录或集合不存在，请先执行初始化。', {
      code: 'HTTP',
      status: 404,
    });
    const client = {
      insert: <T,>(tableName: string): Promise<T[]> => {
        if (tableName === 'green_beans') {
          return Promise.resolve([{ id: 'bean-1' } as T]);
        }

        if (tableName === 'green_bean_purchase_batches') {
          return Promise.resolve([{ id: 'batch-1' } as T]);
        }

        if (tableName === 'app_settings' || tableName === 'bean_sale_specs') {
          return Promise.reject(missingOptionalCollectionError);
        }

        return Promise.resolve([] as T[]);
      },
      list: <T,>(tableName: string): Promise<T[]> => {
        if (tableName === 'green_beans') {
          return Promise.resolve([
            {
              altitude_meters_max: null,
              altitude_meters_min: null,
              code: 'GB-001',
              created_at: '2026-07-03T00:00:00.000Z',
              default_roast_input_grams: 200,
              density_g_per_l: null,
              display_name: '测试生豆',
              grade: 'G1',
              harvest_season: '2025/26',
              id: 'bean-1',
              mill_name: null,
              moisture_percent: null,
              notes: null,
              origin_area: '古吉',
              origin_country: '埃塞俄比亚',
              origin_region: '耶加雪菲',
              process_method: '水洗',
              updated_at: '2026-07-03T00:00:00.000Z',
              variety: '74110',
            } as T,
          ]);
        }

        if (tableName === 'green_bean_purchase_batches') {
          return Promise.resolve([
            {
              created_at: '2026-07-03T00:00:00.000Z',
              green_bean_id: 'bean-1',
              id: 'batch-1',
              purchased_total_price: 720,
              purchased_weight_grams: 4000,
              received_at: '2026-07-03',
              remaining_weight_grams: 4000,
              supplier_name: '供应商 A',
              updated_at: '2026-07-03T00:00:00.000Z',
            } as T,
          ]);
        }

        if (tableName === 'app_settings' || tableName === 'bean_sale_specs' || tableName === 'roast_batches') {
          return Promise.reject(missingOptionalCollectionError);
        }

        return Promise.resolve([] as T[]);
      },
      update: <T,>(): Promise<T[]> => {
        return Promise.resolve([] as T[]);
      },
    } as unknown as PocketBaseRestClient;

    const repository = createGreenBeanInventoryRepository(client);
    const result = await repository.createBean({
      agingDays: 14,
      altitudeMetersMax: null,
      altitudeMetersMin: null,
      code: 'GB-001',
      costTemplateId: null,
      defaultRoastInputGrams: 200,
      defaultSaleUnitPrice: 48,
      defaultSaleUnitWeightGrams: 250,
      densityGPerL: null,
      displayName: '测试生豆',
      flavorTags: ['柑橘', '花香'],
      grade: 'G1',
      harvestSeason: '2025/26',
      millName: '',
      moisturePercent: null,
      notes: '',
      originArea: '古吉',
      originCountry: '埃塞俄比亚',
      originRegion: '耶加雪菲',
      processMethod: '水洗',
      purchaseDate: '2026-07-01',
      purchasedTotalPrice: 720,
      purchasedWeightGrams: 4000,
      remainingWeightGrams: 4000,
      supplierName: '供应商 A',
      tastingEndDays: 40,
      variety: '74110',
    });

    expect(result.data).toEqual(
      expect.objectContaining({
        code: 'GB-001',
        costPerKg: 180,
        grade: 'G1',
        name: '测试生豆',
        stockKg: 4,
      }),
    );
  });
});
