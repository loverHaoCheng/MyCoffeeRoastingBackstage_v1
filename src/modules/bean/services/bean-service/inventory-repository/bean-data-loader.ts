import { AppError } from '@/shared/errors/AppError';
import type { PocketBaseRestClient } from '@/shared/services/pocketBaseRestClient';

import {
  buildInventoryOverviewRecordFromTables,
  getDefaultSaleSpecRecord,
  getLatestPurchaseBatchRecord,
  mapRemoteEditableBeanToFormInput,
  mapRemoteGreenBeanInventoryRecordToBean,
  parseBeanCostTemplateSettingValue,
  parseBeanGradeSettingValue,
  parseBeanSaleDefaultsSettingValue,
} from '../bean.service.shared';
import { buildBeanAggregationMaps } from '../bean.service.inventory-repository.utils';
import type {
  GreenBeanEditableDetail,
  RemoteGreenBeanInventoryRecord,
  RemoteGreenBeanRecord,
  RemotePurchaseBatchRecord,
} from '../bean.service.types';
import type { Bean } from '@/types/domain';

import { createSettingsLoader } from './settings-loader';
import { createCollectionLoader } from './collection-loader';

export function createBeanDataLoader(
  client: Pick<PocketBaseRestClient, 'insert' | 'list' | 'update'>,
  tableName: string,
) {
  const settingsLoader = createSettingsLoader(client);
  const collectionLoader = createCollectionLoader(client);

  return {
    loadInventoryOverviewRecordsFromTables: async (): Promise<RemoteGreenBeanInventoryRecord[]> => {
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
        collectionLoader.listSaleSpecs(),
        collectionLoader.listRoastBatches(),
        settingsLoader.loadBeanSaleDefaultsMap(),
        settingsLoader.loadBeanCostTemplateMap(),
        settingsLoader.loadBeanGradeMap(),
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
    },

    getLatestInventoryBean: async (beanId: string | number): Promise<Bean> => {
      const overviewRecords = await createBeanDataLoader(client, tableName).loadInventoryOverviewRecordsFromTables();
      const record = overviewRecords.find((item) => item.id === String(beanId));

      if (!record) {
        throw new AppError('未找到最新的生豆库存数据。', { code: 'DATA' });
      }

      return mapRemoteGreenBeanInventoryRecordToBean(record);
    },

    getEditableBeanDetail: async (beanId: string | number): Promise<GreenBeanEditableDetail> => {
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
      const saleSpecRows = await collectionLoader.listSaleSpecs({
        match: { green_bean_id: beanId, is_default: true },
      });
      const savedSaleDefaults = parseBeanSaleDefaultsSettingValue(
        (await settingsLoader.loadBeanSaleDefaultsRecord(beanId))?.value,
      );
      const savedCostTemplate = parseBeanCostTemplateSettingValue(
        (await settingsLoader.loadBeanCostTemplateRecord(beanId))?.value,
      );
      const savedGrade = parseBeanGradeSettingValue((await settingsLoader.loadBeanGradeRecord(beanId))?.value);

      return mapRemoteEditableBeanToFormInput(
        beanRow,
        getLatestPurchaseBatchRecord(purchaseRows),
        getDefaultSaleSpecRecord(saleSpecRows),
        savedSaleDefaults,
        savedCostTemplate,
        savedGrade,
      );
    },
  };
}
