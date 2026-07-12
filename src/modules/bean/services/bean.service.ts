import { beanCacheService } from '@/modules/bean/services/beanCache.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import {
  localGreenBeanService,
  mapLocalGreenBeanRecordToBean,
} from '@/modules/bean/services/localGreenBean.service';
import { logger } from '@/shared/logger/logger';
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

export type { BeanRepository } from './bean-service/bean.service.types';
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
      localGreenBeanService.restore(snapshot.localRecord);
    }

    return getBootstrappedBeans();
  },
  finalizeOptimisticBean(optimisticBeanId: string, remoteBean: Bean): Bean[] {
    localGreenBeanService.removeById(optimisticBeanId);
    const nextBeans = mergeBeans([remoteBean]);

    beanCacheService.save(nextBeans.filter((bean) => !String(bean.id).startsWith('local-')), 'remote');

    return nextBeans;
  },
  rollbackOptimisticBean(optimisticBeanId: string): Bean[] {
    localGreenBeanService.removeById(optimisticBeanId);

    return mergeBeans(beanCacheService.getBeans() ?? []);
  },
  persistOptimisticBeanAsPending(input: GreenBeanCreateInput): Bean[] {
    beanSyncService.recordPendingCreate(input);
    const normalizedCode = input.code.trim();
    const existingLocalRecord = localGreenBeanService
      .listRecords()
      .find((record) => record.code === normalizedCode);
    const localRecord = existingLocalRecord ?? localGreenBeanService.create(input);

    return mergeBeans([
      ...(beanCacheService.getBeans() ?? []),
      mapLocalGreenBeanRecordToBean(localRecord),
    ]);
  },
  async createRemoteBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>> {
    if (!beanSyncService.isOnline()) {
      throw new AppError('当前网络不可用，无法同步到 PocketBase。', { code: 'NETWORK' });
    }

    return resolveBeanRepository().createBean(input);
  },
  async createBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>> {
    if (beanSyncService.isOnline()) {
      try {
        const repo = resolveBeanRepository();
        const response = await repo.createBean(input);
        localGreenBeanService.removeByCode(input.code.trim());
        return response;
      } catch (error) {
        logger.warn('bean create failed, fallback to local', { error });
      }
    }

    const localRecord = localGreenBeanService.create(input);
    beanSyncService.recordPendingCreate(input);

    return ok(mapLocalGreenBeanRecordToBean(localRecord));
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

        if (localGreenBeanService.listBeans().length > 0) {
          return ok(mergeBeans([]));
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
    const localRecords = localGreenBeanService.listRecords();
    let uploaded = 0;

    if (localRecords.length > 0) {
      const remoteBeforeSync = await repository.listBeans();
      const remoteCodes = new Set(
        remoteBeforeSync.data
          .map((bean) => bean.code?.trim())
          .filter((code): code is string => Boolean(code)),
      );

      for (const record of localRecords) {
        const normalizedCode = record.code.trim();

        if (normalizedCode.length === 0) {
          continue;
        }

        if (remoteCodes.has(normalizedCode)) {
          localGreenBeanService.removeByCode(normalizedCode);
          continue;
        }

        await repository.createBean(beanSyncService.localRecordToCreateInput(record));
        localGreenBeanService.removeByCode(normalizedCode);
        remoteCodes.add(normalizedCode);
        uploaded += 1;
      }
    }

    const remoteAfterSync = await repository.listBeans();
    const bootstrappedBeforeSync = getBootstrappedBeans();
    const mergedRemoteBeans = mergeBeans(remoteAfterSync.data);

    beanCacheService.save(remoteAfterSync.data, 'remote');

    const beforeSignature = JSON.stringify(
      bootstrappedBeforeSync.map((bean) => `${String(bean.id)}:${bean.updatedAt}`),
    );
    const afterSignature = JSON.stringify(
      mergedRemoteBeans.map((bean) => `${String(bean.id)}:${bean.updatedAt}`),
    );

    return {
      downloaded: beforeSignature === afterSignature ? 0 : mergedRemoteBeans.length,
      uploaded,
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
      try {
        return await resolveBeanRepository().updateBean(beanId, input);
      } catch (error) {
        logger.warn('bean update failed, fallback to pending queue', { error });
      }
    }

    beanSyncService.recordPendingUpdate(beanId, input);

    throw new AppError('当前处于离线状态，更新已记录，将在联网后同步。', {
      code: 'NETWORK',
    });
  },
  async deleteBean(beanId: string | number): Promise<{ queued: boolean; synced: boolean }> {
    if (beanSyncService.isOnline()) {
      try {
        await resolveBeanRepository().deleteBean(beanId);
        return { queued: false, synced: true };
      } catch (error) {
        logger.warn('bean delete failed, fallback to pending queue', { error });
      }
    }

    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      localGreenBeanService.removeById(beanId);
      return { queued: false, synced: true };
    }

    beanSyncService.recordPendingDelete(beanId);
    return { queued: true, synced: false };
  },
  async syncPendingOperations(): Promise<{ failed: number; success: number }> {
    const pendingOps = beanSyncService.getPendingOperations();
    if (pendingOps.length === 0) {
      return { failed: 0, success: 0 };
    }

    const repo = resolveBeanRepository();
    let success = 0;
    let failed = 0;

    for (const op of pendingOps) {
      try {
        if (op.type === 'create') {
          const input = beanSyncService.localRecordToCreateInput(op.payload);
          try {
            await repo.createBean(input);
          } catch (createError) {
            const errMsg = createError instanceof Error ? createError.message : String(createError);
            if (errMsg.includes('409') || errMsg.includes('duplicate') || errMsg.includes('Conflict')) {
              logger.info('bean pending create already exists remotely', { opId: op.id });
              localGreenBeanService.removeByCode(input.code.trim());
              beanSyncService.removePendingOp(op.id);
              success++;
              continue;
            }
            throw createError;
          }
          localGreenBeanService.removeByCode(input.code.trim());
        } else if (op.type === 'update') {
          const { beanId: pendingBeanId, ...pendingInput } = op.payload;
          await repo.updateBean(
            pendingBeanId as string | number,
            beanSyncService.localRecordToCreateInput(pendingInput),
          );
        } else {
          const { beanId: pendingBeanId } = op.payload;
          await repo.deleteBean(pendingBeanId as string | number);
        }
        beanSyncService.removePendingOp(op.id);
        success++;
      } catch (error) {
        logger.error('bean pending operation sync failed', {
          error,
          opId: op.id,
          type: op.type,
        });
        failed++;
      }
    }

    return { failed, success };
  },
};
