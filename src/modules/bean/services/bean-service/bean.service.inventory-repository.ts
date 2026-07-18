import { beanCacheService } from '@/modules/bean/services/beanCache.service';
import { AppError } from '@/shared/errors/AppError';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';
import type { Bean } from '@/types/domain';

import type { GreenBeanEditableDetail, GreenBeanUpdateInput } from '../../types';
import {
  buildInventoryOverviewRecordFromTables,
  compareIsoDateDesc,
  getBeanCostTemplateSettingKey,
  getBeanGradeSettingKey,
  getBeanSaleDefaultsSettingKey,
  getDefaultSaleSpecRecord,
  getLatestPurchaseBatchRecord,
  mapBeanFormInputToTableInput,
  mapRemoteEditableBeanToFormInput,
  mapRemoteGreenBeanInventoryRecordToBean,
  normalizeRemainingWeightGrams,
  normalizeText,
  ok,
  parseBeanCostTemplateSettingValue,
  parseBeanGradeSettingValue,
  parseBeanSaleDefaultsSettingValue,
} from './bean.service.shared';
import {
  buildBeanAggregationMaps,
  createGreenBeanInsertPayload,
  withOptionalCollectionFallback,
} from './bean.service.inventory-repository.utils';
import type {
  BeanCostTemplateSettingValue,
  BeanGradeSettingValue,
  BeanRepository,
  BeanSaleDefaultsSettingValue,
  EditablePurchaseBatchInput,
  RemoteAppSettingRecord,
  RemoteGreenBeanInventoryRecord,
  RemoteGreenBeanRecord,
  RemotePurchaseBatchRecord,
  RemoteRoastBatchOverviewRecord,
  RemoteSaleSpecRecord,
  RoastPlanDisposition,
} from './bean.service.types';

export function createGreenBeanInventoryRepository(
  client: Pick<PocketBaseRestClient, 'delete' | 'insert' | 'list' | 'update'>,
  options: { tableName?: string; viewName?: string } = {},
): BeanRepository {
  const tableName = options.tableName ?? 'green_beans';
  void options.viewName;

  const toFiniteInteger = (value: unknown, fallback = 0): number => {
    const normalizedValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.round(normalizedValue);
  };

  const toNonNegativeInteger = (value: unknown, fallback = 0): number => {
    return Math.max(0, toFiniteInteger(value, fallback));
  };

  const loadSettingRecord = async (key: string): Promise<null | RemoteAppSettingRecord> => {
    const rows = await client.list<RemoteAppSettingRecord>('app_settings', {
      limit: 1,
      match: { key },
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return rows[0] ?? null;
  };

  const loadBeanSaleDefaultsRecord = async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
    return withOptionalCollectionFallback(
      'app_settings',
      'load bean sale defaults',
      () => loadSettingRecord(getBeanSaleDefaultsSettingKey(String(beanId))),
      null,
    );
  };

  const loadBeanCostTemplateRecord = async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
    return withOptionalCollectionFallback(
      'app_settings',
      'load bean cost template',
      () => loadSettingRecord(getBeanCostTemplateSettingKey(String(beanId))),
      null,
    );
  };

  const loadBeanGradeRecord = async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
    return withOptionalCollectionFallback(
      'app_settings',
      'load bean grade',
      () => loadSettingRecord(getBeanGradeSettingKey(String(beanId))),
      null,
    );
  };

  const loadSettingMap = async <T,>(
    prefix: string,
    parser: (value: unknown) => null | T,
    operation: string,
  ): Promise<Map<string, T>> => {
    return withOptionalCollectionFallback('app_settings', operation, async () => {
      const rows = await client.list<RemoteAppSettingRecord>('app_settings', {
        orderBy: {
          ascending: false,
          column: 'updated_at',
        },
      });
      const result = new Map<string, T>();

      rows.forEach((row) => {
        if (!row.key.startsWith(prefix)) {
          return;
        }

        const beanId = row.key.replace(prefix, '');
        const parsedValue = parser(row.value);

        if (!beanId || !parsedValue || result.has(beanId)) {
          return;
        }

        result.set(beanId, parsedValue);
      });

      return result;
    }, new Map<string, T>());
  };

  const loadBeanSaleDefaultsMap = () =>
    loadSettingMap<BeanSaleDefaultsSettingValue>(
      'green_bean_sale_defaults:',
      parseBeanSaleDefaultsSettingValue,
      'load bean sale defaults map',
    );
  const loadBeanCostTemplateMap = () =>
    loadSettingMap<BeanCostTemplateSettingValue>(
      'green_bean_cost_template:',
      parseBeanCostTemplateSettingValue,
      'load bean cost template map',
    );
  const loadBeanGradeMap = () =>
    loadSettingMap<BeanGradeSettingValue>(
      'green_bean_grade:',
      parseBeanGradeSettingValue,
      'load bean grade map',
    );

  const upsertSetting = async (key: string, value: Record<string, unknown>, operation: string) => {
    await withOptionalCollectionFallback('app_settings', operation, async () => {
      const currentRecord = await loadSettingRecord(key);
      const payload = { key, value };

      if (!currentRecord) {
        await client.insert('app_settings', payload);
        return;
      }

      await client.update('app_settings', payload, {
        match: { id: currentRecord.id },
        select: '*',
      });
    }, undefined);
  };

  const saveBeanSaleDefaults = async (
    beanId: string | number,
    input: Pick<GreenBeanUpdateInput, 'defaultSaleUnitPrice' | 'defaultSaleUnitWeightGrams'>,
  ) => {
    return upsertSetting(
      getBeanSaleDefaultsSettingKey(String(beanId)),
      {
        defaultSaleUnitPrice: input.defaultSaleUnitPrice,
        defaultSaleUnitWeightGrams: input.defaultSaleUnitWeightGrams ?? null,
        updatedAt: new Date().toISOString(),
      },
      'save bean sale defaults',
    );
  };

  const saveBeanCostTemplate = async (beanId: string | number, costTemplateId: null | string) => {
    return upsertSetting(
      getBeanCostTemplateSettingKey(String(beanId)),
      {
        costTemplateId,
        updatedAt: new Date().toISOString(),
      },
      'save bean cost template',
    );
  };

  const saveBeanGrade = async (beanId: string | number, grade: null | string | undefined) => {
    return upsertSetting(
      getBeanGradeSettingKey(String(beanId)),
      {
        grade: normalizeText(grade),
        updatedAt: new Date().toISOString(),
      },
      'save bean grade',
    );
  };

  const listSaleSpecs = (
    options?: Parameters<typeof client.list<RemoteSaleSpecRecord>>[1],
  ): Promise<RemoteSaleSpecRecord[]> => {
    return withOptionalCollectionFallback(
      'bean_sale_specs',
      'list bean sale specs',
      () => client.list<RemoteSaleSpecRecord>('bean_sale_specs', options),
      [],
    );
  };

  const listRoastBatches = (): Promise<RemoteRoastBatchOverviewRecord[]> => {
    return withOptionalCollectionFallback(
      'roast_batches',
      'list roast batches for bean aggregation',
      () => client.list<RemoteRoastBatchOverviewRecord>('roast_batches'),
      [],
    );
  };

  const upsertOptionalDefaultSaleSpec = async (
    beanId: string | number,
    input: GreenBeanUpdateInput,
  ): Promise<void> => {
    await withOptionalCollectionFallback('bean_sale_specs', 'upsert default sale spec', async () => {
      const existingSaleSpecs = await client.list<RemoteSaleSpecRecord>('bean_sale_specs', {
        match: { green_bean_id: beanId, is_default: true },
      });
      const defaultSaleSpec = getDefaultSaleSpecRecord(existingSaleSpecs);

      if (input.defaultSaleUnitWeightGrams == null) {
        if (defaultSaleSpec) {
          await client.update(
            'bean_sale_specs',
            {
              unit_price: input.defaultSaleUnitPrice,
            },
            {
              match: { id: defaultSaleSpec.id },
              select: '*',
            },
          );
        }

        return;
      }

      if (!defaultSaleSpec) {
        await client.insert('bean_sale_specs', {
          channel: 'default',
          green_bean_id: beanId,
          is_default: true,
          unit_price: input.defaultSaleUnitPrice,
          unit_weight_grams: input.defaultSaleUnitWeightGrams,
        });
        return;
      }

      await client.update(
        'bean_sale_specs',
        {
          unit_price: input.defaultSaleUnitPrice,
          unit_weight_grams: input.defaultSaleUnitWeightGrams,
        },
        {
          match: { id: defaultSaleSpec.id },
          select: '*',
        },
      );
    }, undefined);
  };

  const loadInventoryOverviewRecordsFromTables = async (): Promise<RemoteGreenBeanInventoryRecord[]> => {
    const [
      beans,
      purchaseBatches,
      saleSpecs,
      roastBatches,
      savedSaleDefaultsMap,
      savedCostTemplateMap,
      savedGradeMap,
    ] = await Promise.all([
      client.list<RemoteGreenBeanRecord>(tableName, {
        orderBy: {
          ascending: false,
          column: 'created_at',
        },
      }),
      client.list<RemotePurchaseBatchRecord>('green_bean_purchase_batches'),
      listSaleSpecs(),
      listRoastBatches(),
      loadBeanSaleDefaultsMap(),
      loadBeanCostTemplateMap(),
      loadBeanGradeMap(),
    ]);

    const { purchaseBatchMap, roastBatchMap, saleSpecMap } = buildBeanAggregationMaps(
      purchaseBatches,
      saleSpecs,
      roastBatches,
    );

    return beans.map((bean) =>
      buildInventoryOverviewRecordFromTables(
        bean,
        purchaseBatchMap.get(bean.id) ?? [],
        saleSpecMap.get(bean.id) ?? [],
        (roastBatchMap.get(bean.id) ?? []).length,
        savedSaleDefaultsMap.get(bean.id) ?? null,
        savedCostTemplateMap.get(bean.id) ?? null,
        savedGradeMap.get(bean.id) ?? null,
      ),
    );
  };

  const getLatestInventoryBean = async (beanId: string | number): Promise<Bean> => {
    const overviewRecords = await loadInventoryOverviewRecordsFromTables();
    const record = overviewRecords.find((item) => item.id === String(beanId));

    if (!record) {
      throw new AppError('未找到最新的生豆库存数据。', { code: 'DATA' });
    }

    return mapRemoteGreenBeanInventoryRecordToBean(record);
  };

  const getEditableBeanDetail = async (beanId: string | number): Promise<GreenBeanEditableDetail> => {
    const beanRows = await client.list<RemoteGreenBeanRecord>(tableName, {
      limit: 1,
      match: { id: beanId },
    });

    const beanRow = beanRows[0];

    if (!beanRow) {
      throw new AppError('未找到生豆主档。', { code: 'DATA' });
    }

    const purchaseRows = await client.list<RemotePurchaseBatchRecord>('green_bean_purchase_batches', {
      match: { green_bean_id: beanId },
    });
    const saleSpecRows = await listSaleSpecs({
      match: { green_bean_id: beanId, is_default: true },
    });
    const savedSaleDefaults = parseBeanSaleDefaultsSettingValue((await loadBeanSaleDefaultsRecord(beanId))?.value);
    const savedCostTemplate = parseBeanCostTemplateSettingValue((await loadBeanCostTemplateRecord(beanId))?.value);
    const savedGrade = parseBeanGradeSettingValue((await loadBeanGradeRecord(beanId))?.value);

    return mapRemoteEditableBeanToFormInput(
      beanRow,
      getLatestPurchaseBatchRecord(purchaseRows),
      getDefaultSaleSpecRecord(saleSpecRows),
      savedSaleDefaults,
      savedCostTemplate,
      savedGrade,
    );
  };

  const upsertLatestPurchaseBatch = async (beanId: string | number, input: GreenBeanUpdateInput): Promise<void> => {
    const payload: EditablePurchaseBatchInput = {
      purchase_date: input.purchaseDate,
      purchased_total_price: input.purchasedTotalPrice,
      purchased_weight_grams: input.purchasedWeightGrams,
      remaining_weight_grams: normalizeRemainingWeightGrams(input),
      supplier_name: normalizeText(input.supplierName),
    };

    const latestBatchRows = await client.list<RemotePurchaseBatchRecord>('green_bean_purchase_batches', {
      match: { green_bean_id: beanId },
    });

    const latestBatch = getLatestPurchaseBatchRecord(latestBatchRows);

    if (!latestBatch) {
      await client.insert('green_bean_purchase_batches', {
        green_bean_id: beanId,
        purchased_total_price: payload.purchased_total_price,
        purchased_weight_grams: payload.purchased_weight_grams,
        received_at: payload.purchase_date,
        remaining_weight_grams: payload.remaining_weight_grams,
        supplier_name: payload.supplier_name ?? null,
      });
      return;
    }

    await client.update(
      'green_bean_purchase_batches',
      {
        ...payload,
        remaining_weight_grams: payload.remaining_weight_grams,
      },
      {
        match: { id: latestBatch.id },
        select: '*',
      },
    );
  };

  return {
    async getBeanById(beanId) {
      const beans = await this.listBeans();
      return ok(beans.data.find((bean) => String(bean.id) === String(beanId)) ?? null);
    },
    async adjustRemainingWeight(beanId, deltaGrams) {
      const purchaseRows = await client.list<RemotePurchaseBatchRecord>('green_bean_purchase_batches', {
        match: { green_bean_id: beanId },
      });

      const latestBatch = getLatestPurchaseBatchRecord(purchaseRows);

      if (!latestBatch) {
        throw new AppError('当前生豆缺少采购批次，无法更新剩余库存。', { code: 'DATA' });
      }

      const normalizedPurchasedWeightGrams = toNonNegativeInteger(latestBatch.purchased_weight_grams, 0);
      const normalizedCurrentRemainingWeight = toNonNegativeInteger(
        latestBatch.remaining_weight_grams,
        normalizedPurchasedWeightGrams,
      );
      const normalizedDeltaGrams = toFiniteInteger(deltaGrams, 0);
      const nextRemainingWeight = normalizedCurrentRemainingWeight - normalizedDeltaGrams;

      if (nextRemainingWeight < 0) {
        throw new AppError('剩余库存不足，无法记录本次烘焙。', { code: 'DATA' });
      }

      await client.update(
        'green_bean_purchase_batches',
        {
          remaining_weight_grams: Math.min(nextRemainingWeight, normalizedPurchasedWeightGrams),
        },
        {
          match: { id: latestBatch.id },
          select: '*',
        },
      );

      const bean = await getLatestInventoryBean(beanId);
      beanCacheService.save([bean], 'remote');
      return ok(bean);
    },
    async getEditableBean(beanId) {
      return ok(await getEditableBeanDetail(beanId));
    },
    async listBeans() {
      const rows = await loadInventoryOverviewRecordsFromTables();
      const beans = rows
        .sort((left, right) => compareIsoDateDesc(left.created_at, right.created_at))
        .map((record) => mapRemoteGreenBeanInventoryRecordToBean(record));

      beanCacheService.save(beans, 'remote');
      return ok(beans);
    },
    async syncBeans() {
      return this.listBeans();
    },
    async updateBean(beanId, input) {
      const rows = await client.update(tableName, mapBeanFormInputToTableInput(input) as Record<string, unknown>, {
        match: { id: beanId },
        select: '*',
      });

      if (rows.length === 0) {
        throw new AppError('更新失败：未找到记录。', { code: 'DATA' });
      }

      await saveBeanGrade(beanId, input.grade);
      await saveBeanCostTemplate(beanId, input.costTemplateId ?? null);
      await upsertLatestPurchaseBatch(beanId, input);
      await upsertOptionalDefaultSaleSpec(beanId, input);
      await saveBeanSaleDefaults(beanId, input);

      const bean = await getLatestInventoryBean(beanId);
      beanCacheService.save([bean], 'remote');
      return ok(bean);
    },
    async deleteBean(beanId, roastPlanDisposition: RoastPlanDisposition) {
      const relatedRoastBatches = await client.list<{ id: string }>('roast_batches', {
        match: { green_bean_id: beanId },
        select: 'id',
      });

      await Promise.all(
        relatedRoastBatches.map((batch) =>
          client.delete('roast_curve_records', { match: { roast_batch_id: batch.id } }),
        ),
      );
      await client.delete('roast_batches', { match: { green_bean_id: beanId } });
      await client.delete('green_bean_purchase_batches', { match: { green_bean_id: beanId } });
      await client.delete('roast_records', { match: { green_bean_id: beanId } });

      if (roastPlanDisposition === 'makeGeneric') {
        const relatedRoastProfiles = await client.list<{ id: string }>('roast_profiles', {
          match: { green_bean_id: beanId },
          select: 'id',
        });

        await Promise.all(
          relatedRoastProfiles.map((profile) =>
            client.update('roast_profiles', { green_bean_id: null }, {
              match: { id: profile.id },
              select: 'id',
            }),
          ),
        );
      } else {
        await client.delete('roast_profiles', { match: { green_bean_id: beanId } });
      }

      await client.delete('bean_sale_specs', { match: { green_bean_id: beanId } });
      await client.delete(tableName, { match: { id: beanId } });
    },
    async createBean(input) {
      const greenBeanPayload = createGreenBeanInsertPayload(input);
      const insertedBeans = await client.insert<{ id: string }>(tableName, greenBeanPayload, { select: '*' });
      const insertedBean = insertedBeans[0];

      if (!insertedBean || typeof insertedBean.id !== 'string') {
        throw new AppError('创建生豆失败：缺少主键。', { code: 'DATA' });
      }

      const newBeanId = insertedBean.id;

      await saveBeanGrade(newBeanId, input.grade);
      await saveBeanCostTemplate(newBeanId, input.costTemplateId ?? null);
      await upsertLatestPurchaseBatch(newBeanId, input);
      await upsertOptionalDefaultSaleSpec(newBeanId, input);
      await saveBeanSaleDefaults(newBeanId, input);

      const bean = await getLatestInventoryBean(newBeanId);
      beanCacheService.save([bean], 'remote');
      return ok(bean);
    },
  };
}
