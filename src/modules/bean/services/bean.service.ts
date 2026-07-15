import { beanCacheService } from '@/modules/bean/services/beanCache.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import {
  localGreenBeanService,
  mapLocalGreenBeanRecordToBean,
} from '@/modules/bean/services/localGreenBean.service';
import { AppError } from '@/shared/errors/AppError';
import type { ApiResponse } from '@/services/api.types';
import type { Bean } from '@/types/domain';

import type { GreenBeanCreateInput, GreenBeanEditableDetail, GreenBeanUpdateInput } from '../types';
import type { LocalGreenBeanRecord } from '../types/localGreenBean';
import {
  createGreenBeanInventoryRepository,
  createRemoteBeanRepository,
  MockBeanRepository,
  resolveBeanRepository,
} from './bean-service/bean.service.repositories';
import {
  getBootstrappedBeans,
  mapRemoteBeanRecordToBean,
  mapRemoteGreenBeanInventoryRecordToBean,
  mergeBeans,
  ok,
  toLocalEditableBeanDetail,
} from './bean-service/bean.service.shared';
import {
  addPendingOptimisticCreateBeanId,
  pruneInvisibleLocalBeans,
  removePendingOptimisticCreateBeanId,
} from './bean.service.state';

export type { BeanRepository, RoastPlanDisposition } from './bean-service/bean.service.types';
export {
  createGreenBeanInventoryRepository,
  createRemoteBeanRepository,
  MockBeanRepository,
  mapRemoteBeanRecordToBean,
  mapRemoteGreenBeanInventoryRecordToBean,
  resolveBeanRepository,
};

export const beanService = {
  getBootstrappedBeans,
  createOptimisticBean(input: GreenBeanCreateInput): Bean {
    const localRecord = localGreenBeanService.create(input);
    addPendingOptimisticCreateBeanId(localRecord.id);
    return mapLocalGreenBeanRecordToBean(localRecord);
  },
  prepareOptimisticDelete(beanId: Bean['id']): {
    cacheBeans: Bean[] | null;
    cacheSource: 'mock' | 'remote' | null;
    localRecord: LocalGreenBeanRecord | null;
  } {
    const cacheBeans = beanCacheService.getBeans();
    const cacheStatus = beanCacheService.getStatus();
    const beanIdString = String(beanId);
    const localRecord =
      beanIdString.startsWith('local-') ? localGreenBeanService.findRecordById(beanIdString) : null;

    if (cacheBeans) {
      const nextCacheBeans = cacheBeans.filter((bean) => String(bean.id) !== beanIdString);
      beanCacheService.save(nextCacheBeans, cacheStatus.source ?? 'remote');
    }

    if (localRecord) {
      removePendingOptimisticCreateBeanId(localRecord.id);
      localGreenBeanService.removeById(beanIdString);
    }

    return {
      cacheBeans,
      cacheSource: cacheStatus.source,
      localRecord,
    };
  },
  rollbackOptimisticDelete(snapshot: {
    cacheBeans: Bean[] | null;
    cacheSource: 'mock' | 'remote' | null;
    localRecord: LocalGreenBeanRecord | null;
  }): Bean[] {
    if (snapshot.cacheBeans) {
      beanCacheService.save(snapshot.cacheBeans, snapshot.cacheSource ?? 'remote');
    }

    if (snapshot.localRecord) {
      addPendingOptimisticCreateBeanId(snapshot.localRecord.id);
      localGreenBeanService.restore(snapshot.localRecord);
    }

    return getBootstrappedBeans();
  },
  finalizeOptimisticBean(optimisticBeanId: string, remoteBean: Bean): Bean[] {
    removePendingOptimisticCreateBeanId(optimisticBeanId);
    localGreenBeanService.removeById(optimisticBeanId);
    const nextBeans = mergeBeans([remoteBean]);

    beanCacheService.save(nextBeans.filter((bean) => !String(bean.id).startsWith('local-')), 'remote');

    return nextBeans;
  },
  rollbackOptimisticBean(optimisticBeanId: string): Bean[] {
    removePendingOptimisticCreateBeanId(optimisticBeanId);
    localGreenBeanService.removeById(optimisticBeanId);

    return mergeBeans(beanCacheService.getBeans() ?? []);
  },
  async createRemoteBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>> {
    if (!beanSyncService.isOnline()) {
      throw new AppError('当前网络不可用，无法同步到 PocketBase。', { code: 'NETWORK' });
    }

    return resolveBeanRepository().createBean(input);
  },
  async createBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>> {
    if (!beanSyncService.isOnline()) {
      throw new AppError('当前网络不可用，无法同步到 PocketBase。', { code: 'NETWORK' });
    }

    const repo = resolveBeanRepository();
    const response = await repo.createBean(input);
    localGreenBeanService.removeByCode(input.code.trim());
    return response;
  },
  async adjustRemainingWeight(beanId: string | number, deltaGrams: number): Promise<ApiResponse<Bean>> {
    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      const updatedRecord = localGreenBeanService.adjustRemainingWeight(beanId, deltaGrams);
      return ok(mapLocalGreenBeanRecordToBean(updatedRecord));
    }

    if (!beanSyncService.isOnline()) {
      throw new AppError('当前离线，无法更新生豆剩余库存，请联网后再试。', { code: 'NETWORK' });
    }

    return resolveBeanRepository().adjustRemainingWeight(beanId, deltaGrams);
  },
  async getEditableBean(beanId: string | number): Promise<ApiResponse<GreenBeanEditableDetail>> {
    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      const localRecord = localGreenBeanService.listRecords().find((record) => record.id === beanId);

      if (!localRecord) {
        throw new AppError('未找到本地生豆记录。', { code: 'DATA' });
      }

      return ok(toLocalEditableBeanDetail(localRecord));
    }

    return resolveBeanRepository().getEditableBean(beanId);
  },
  async getBeanById(beanId: string | number): Promise<ApiResponse<Bean | null>> {
    const response = await this.listBeans();

    return ok(response.data.find((bean) => String(bean.id) === String(beanId)) ?? null);
  },
  async listBeans(): Promise<ApiResponse<Bean[]>> {
    try {
      const response = await resolveBeanRepository().listBeans();
      pruneInvisibleLocalBeans();

      return ok(mergeBeans(response.data));
    } catch (error) {
      if (error instanceof AppError) {
        if (error.code === 'AUTH' || error.code === 'CONFIG' || error.code === 'DATA') {
          beanCacheService.markFailure(error.code);
          throw error;
        }

        const cachedBeans = beanCacheService.markFallback(error.code);

        if (cachedBeans) {
          return ok(mergeBeans(cachedBeans));
        }

        beanCacheService.markFailure(error.code);

        const visibleLocalBeans = mergeBeans([]);

        if (visibleLocalBeans.length > 0) {
          return ok(visibleLocalBeans);
        }
      }

      throw error;
    }
  },
  async syncLocalAndRemote(): Promise<{ downloaded: number; uploaded: number }> {
    if (!beanSyncService.isOnline()) {
      return { downloaded: 0, uploaded: 0 };
    }

    const repository = resolveBeanRepository();
    const bootstrappedBeforeSync = getBootstrappedBeans();
    const remoteAfterSync = await repository.listBeans();
    pruneInvisibleLocalBeans();
    const mergedRemoteBeans = mergeBeans(remoteAfterSync.data);

    beanCacheService.save(remoteAfterSync.data, 'remote');
    beanSyncService.clearPendingOps();

    const beforeSignature = JSON.stringify(
      bootstrappedBeforeSync.map((bean) => `${String(bean.id)}:${bean.updatedAt}`),
    );
    const afterSignature = JSON.stringify(
      mergedRemoteBeans.map((bean) => `${String(bean.id)}:${bean.updatedAt}`),
    );

    return {
      downloaded: beforeSignature === afterSignature ? 0 : mergedRemoteBeans.length,
      uploaded: 0,
    };
  },
  syncBeans(): Promise<ApiResponse<Bean[]>> {
    return this.listBeans();
  },
  async updateBean(beanId: string | number, input: GreenBeanUpdateInput): Promise<ApiResponse<Bean>> {
    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      const updatedRecord = localGreenBeanService.update(beanId, input);
      return ok(mapLocalGreenBeanRecordToBean(updatedRecord));
    }

    if (beanSyncService.isOnline()) {
      return resolveBeanRepository().updateBean(beanId, input);
    }

    throw new AppError('当前离线，无法同步到 PocketBase。', {
      code: 'NETWORK',
    });
  },
  async deleteBean(
    beanId: string | number,
    roastPlanDisposition: import('./bean-service/bean.service.types').RoastPlanDisposition,
  ): Promise<{ queued: boolean; synced: boolean }> {
    if (beanSyncService.isOnline()) {
      await resolveBeanRepository().deleteBean(beanId, roastPlanDisposition);
      return { queued: false, synced: true };
    }

    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      removePendingOptimisticCreateBeanId(beanId);
      localGreenBeanService.removeById(beanId);
      return { queued: false, synced: true };
    }

    throw new AppError('当前离线，无法同步到 PocketBase。', {
      code: 'NETWORK',
    });
  },
};
