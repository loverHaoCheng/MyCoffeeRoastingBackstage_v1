import { AppError } from '@/shared/errors/AppError';
import type { ApiResponse } from '@/services/api.types';

import type {
  RoastBatchCreateInput,
  RoastBatchRecord,
  RoastBatchUpdateInput,
} from '../types/roastBatch';
import {
  hasGreenBeanConnection,
  ok,
  resolveNormalizedRoastLevel,
  resolveRoastedBeanName,
  toPocketBaseRoastBatchCreatePayload,
  toPocketBaseRoastBatchPayload,
} from './roast-batch/roastBatch.service.shared';
import {
  roastBatchCrud,
  roastBatchRemoteSync,
  resolveRoastBatchRepository,
} from './roast-batch/roastBatch.service.repositories';
import {
  createOptimisticLocalBatchId,
  getBatchSyncSnapshot,
  isOptimisticLocalBatchId,
  loadLocalBatches,
  pendingOptimisticCreateBatchIds,
  removeStoredBatch,
  restoreStoredBatch,
  saveBatchRecord,
  saveLocalBatches,
  sortBatches,
} from './roast-batch/roastBatch.service.state';

export { toPocketBaseRoastBatchCreatePayload, toPocketBaseRoastBatchPayload };

export const roastBatchService = {
  getBootstrappedBatches(): RoastBatchRecord[] {
    return sortBatches(loadLocalBatches());
  },
  createOptimisticBatch(input: RoastBatchCreateInput): RoastBatchRecord {
    const now = new Date().toISOString();
    const record: RoastBatchRecord = {
      ...input,
      roastedBeanName: resolveRoastedBeanName(input.roastedBeanName, input.greenBeanName),
      roastLevel: resolveNormalizedRoastLevel(input.roastLevel, input.inputWeightGrams, input.outputWeightGrams),
      id: createOptimisticLocalBatchId(),
      salesMode: input.salesMode ?? 'sale',
      status: input.status ?? 'completed',
      imageUrls: input.imageUrls ?? [],
      createdAt: now,
      updatedAt: now,
    };

    pendingOptimisticCreateBatchIds.add(record.id);
    saveBatchRecord(record);

    return record;
  },
  removeOptimisticBatch(batchId: string): RoastBatchRecord | null {
    const removedBatch = loadLocalBatches().find((batch) => batch.id === batchId) ?? null;

    removeStoredBatch(batchId);

    return removedBatch;
  },
  restoreOptimisticBatch(batch: RoastBatchRecord): RoastBatchRecord[] {
    restoreStoredBatch(batch);

    return sortBatches(loadLocalBatches());
  },
  finalizeOptimisticBatch(optimisticBatchId: string, remoteBatch: RoastBatchRecord): RoastBatchRecord[] {
    pendingOptimisticCreateBatchIds.delete(optimisticBatchId);
    removeStoredBatch(optimisticBatchId);
    saveBatchRecord(remoteBatch);

    return sortBatches(loadLocalBatches());
  },
  rollbackOptimisticBatch(optimisticBatchId: string): RoastBatchRecord[] {
    pendingOptimisticCreateBatchIds.delete(optimisticBatchId);
    removeStoredBatch(optimisticBatchId);

    return sortBatches(loadLocalBatches());
  },
  async createBatch(input: RoastBatchCreateInput): Promise<ApiResponse<RoastBatchRecord>> {
    return roastBatchCrud.createBatch(input, resolveRoastBatchRepository());
  },
  async deleteBatch(batchId: string): Promise<void> {
    try {
      await roastBatchCrud.deleteBatch(batchId, resolveRoastBatchRepository());
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('删除烘焙记录失败。', { code: 'NETWORK', cause: error });
    }
  },
  async listBatches(): Promise<ApiResponse<RoastBatchRecord[]>> {
    try {
      const response = await resolveRoastBatchRepository().listBatches();

      saveLocalBatches(sortBatches(response.data));

      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('获取烘焙记录失败。', { code: 'NETWORK', cause: error });
    }
  },
  async updateBatch(batchId: string, input: RoastBatchUpdateInput): Promise<ApiResponse<RoastBatchRecord>> {
    try {
      return await roastBatchCrud.updateBatch(batchId, input, resolveRoastBatchRepository());
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('更新烘焙记录失败。', { code: 'NETWORK', cause: error });
    }
  },
  async syncLocalAndRemote(): Promise<{ downloaded: number; uploaded: number }> {
    if (!hasGreenBeanConnection() || typeof navigator === 'undefined' || !navigator.onLine) {
      return { downloaded: 0, uploaded: 0 };
    }

    if (pendingOptimisticCreateBatchIds.size > 0) {
      return { downloaded: 0, uploaded: 0 };
    }

    return roastBatchRemoteSync();
  },
  hasPendingOptimisticCreations(): boolean {
    return pendingOptimisticCreateBatchIds.size > 0;
  },
  getBatchSyncSnapshot,
  isOptimisticLocalBatchId,
  ok,
};
