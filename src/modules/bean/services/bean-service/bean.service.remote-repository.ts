import { AppError } from '@/shared/errors/AppError';

import { mapRemoteBeanRecordToBean, ok } from './bean.service.shared';
import type { BeanRepository, RemoteBeanClient } from './bean.service.types';

export function createRemoteBeanRepository(
  client: RemoteBeanClient,
  tableName = 'beans',
): BeanRepository {
  return {
    async getBeanById(beanId) {
      const beans = await this.listBeans();

      return ok(beans.data.find((bean) => bean.id === beanId) ?? null);
    },
    getEditableBean() {
      return Promise.reject(new AppError('此仓库不支持编辑详情，请使用 PocketBaseRestClient 仓库。', { code: 'CONFIG' }));
    },
    adjustRemainingWeight() {
      return Promise.reject(new AppError('此仓库不支持库存调整，请使用 PocketBaseRestClient 仓库。', { code: 'CONFIG' }));
    },
    async listBeans() {
      const result = await client.from(tableName).select('*').order('created_at', { ascending: false });

      if (result.error) {
        throw new AppError(result.error.message, {
          code: 'NETWORK',
          cause: result.error,
        });
      }

      return ok((result.data ?? []).map(mapRemoteBeanRecordToBean));
    },
    syncBeans() {
      return this.listBeans();
    },
    updateBean() {
      return Promise.reject(new AppError('此仓库不支持更新，请使用 PocketBaseRestClient 仓库。', { code: 'CONFIG' }));
    },
    deleteBean() {
      return Promise.resolve();
    },
    createBean() {
      return Promise.reject(new AppError('此仓库不支持创建，请使用 PocketBaseRestClient 仓库。', { code: 'CONFIG' }));
    },
  };
}
