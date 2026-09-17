import { beanCacheService } from '@/modules/bean/services/beanCache.service';
import { AppError } from '@/shared/errors/AppError';
import { PocketBaseRestClient } from '@/shared/services/pocketBaseRestClient';
import type { Bean } from '@/types/domain';

import type { GreenBeanFormInput } from '../../types';
import { compareIsoDateDesc, mapBeanFormInputToTableInput, ok } from './bean.service.shared';
import { mapRemoteGreenBeanInventoryRecordToBean } from './bean.service.shared';
import { createGreenBeanInsertPayload } from './bean.service.inventory-repository.utils';
import type { BeanRepository, RoastPlanDisposition } from './bean.service.types';

import { createBeanDataLoader } from './inventory-repository/bean-data-loader';
import { createBeanDeleter } from './inventory-repository/bean-deleter';
import { createCollectionLoader } from './inventory-repository/collection-loader';
import { createPurchaseBatchManager } from './inventory-repository/purchase-batch-manager';
import { createSettingsLoader } from './inventory-repository/settings-loader';

export function createGreenBeanInventoryRepository(
  client: Pick<PocketBaseRestClient, 'delete' | 'insert' | 'list' | 'request' | 'update'>,
  options: { tableName?: string; viewName?: string } = {},
): BeanRepository {
  const tableName = options.tableName ?? 'green_beans';
  void options.viewName;

  const settingsLoader = createSettingsLoader(client);
  const collectionLoader = createCollectionLoader(client);
  const purchaseBatchManager = createPurchaseBatchManager(client);
  const beanDataLoader = createBeanDataLoader(client, tableName);
  const beanDeleter = createBeanDeleter(client, tableName);

  return {
    async getBeanById(beanId) {
      const beans = await this.listBeans();
      return ok(beans.data.find((bean) => String(bean.id) === String(beanId)) ?? null);
    },

    async adjustRemainingWeight(beanId, deltaGrams) {
      await purchaseBatchManager.adjustRemainingWeight(beanId, deltaGrams);
      const bean = await beanDataLoader.getLatestInventoryBean(beanId);
      beanCacheService.save([bean], 'remote');
      return ok(bean);
    },

    async getEditableBean(beanId) {
      return ok(await beanDataLoader.getEditableBeanDetail(beanId));
    },

    async listBeans() {
      const rows = await beanDataLoader.loadInventoryOverviewRecordsFromTables();
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

      await settingsLoader.saveBeanGrade(beanId, input.grade);
      await settingsLoader.saveBeanCostTemplate(beanId, input.costTemplateId ?? null);
      await purchaseBatchManager.upsertLatestPurchaseBatch(beanId, input);
      await collectionLoader.upsertOptionalDefaultSaleSpec(beanId, input);
      await settingsLoader.saveBeanSaleDefaults(beanId, input);

      const bean = await beanDataLoader.getLatestInventoryBean(beanId);
      beanCacheService.save([bean], 'remote');
      return ok(bean);
    },

    async deleteBean(beanId, roastPlanDisposition: RoastPlanDisposition) {
      await beanDeleter.deleteBean(beanId, roastPlanDisposition);
    },

    async createBean(input: GreenBeanFormInput) {
      const greenBeanPayload = createGreenBeanInsertPayload(input);
      const insertedBeans = await client.insert<{ id: string }>(tableName, greenBeanPayload, { select: '*' });
      const insertedBean = insertedBeans[0];

      if (!insertedBean || typeof insertedBean.id !== 'string') {
        throw new AppError('创建生豆失败：缺少主键。', { code: 'DATA' });
      }

      const newBeanId = insertedBean.id;

      await settingsLoader.saveBeanGrade(newBeanId, input.grade);
      await settingsLoader.saveBeanCostTemplate(newBeanId, input.costTemplateId ?? null);
      await purchaseBatchManager.upsertLatestPurchaseBatch(newBeanId, input);
      await collectionLoader.upsertOptionalDefaultSaleSpec(newBeanId, input);
      await settingsLoader.saveBeanSaleDefaults(newBeanId, input);

      const bean = await beanDataLoader.getLatestInventoryBean(newBeanId);
      beanCacheService.save([bean], 'remote');
      return ok(bean);
    },
  };
}
