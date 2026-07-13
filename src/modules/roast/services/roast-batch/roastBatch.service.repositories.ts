import { beanService } from '@/modules/bean/services';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';
import type { ApiResponse } from '@/services/api.types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

import type {
  RoastBatchCreateInput,
  RoastBatchRecord,
  RoastBatchUpdateInput,
} from '../../types/roastBatch';
import { roastedCoffeeBeanMirrorService } from '../roastedCoffeeBeanMirror.service';
import {
  getGreenBeanClient,
  getInventoryImpactWeight,
  getLocalBatchAt,
  getNextBatchState,
  hasGreenBeanConnection,
  hasOverviewSalesModeField,
  isMissingRemoteResourceError,
  isMissingRoastedBeanNameColumnError,
  mapUnknownRemoteRecord,
  ok,
  omitRoastedBeanNamePayload,
  resolveNormalizedRoastLevel,
  resolveRoastedBeanName,
  rollbackInventoryAdjustments,
  toPocketBaseRoastBatchCreatePayload,
  toPocketBaseRoastBatchPayload,
} from './roastBatch.service.shared';
import {
  loadLocalBatches,
  removeStoredBatch,
  saveBatchRecord,
  saveLocalBatches,
  sortBatches,
} from './roastBatch.service.state';

export interface RoastBatchRepository {
  createBatch(input: RoastBatchCreateInput): Promise<ApiResponse<RoastBatchRecord>>;
  deleteBatch(batchId: string): Promise<void>;
  getBatchById(batchId: string): Promise<null | RoastBatchRecord>;
  listBatches(): Promise<ApiResponse<RoastBatchRecord[]>>;
  updateBatch(batchId: string, input: RoastBatchUpdateInput): Promise<ApiResponse<RoastBatchRecord>>;
}

class MockRoastBatchRepository implements RoastBatchRepository {
  createBatch(input: RoastBatchCreateInput) {
    const batches = loadLocalBatches();
    const now = new Date().toISOString();
    const record: RoastBatchRecord = {
      ...input,
      roastedBeanName: resolveRoastedBeanName(input.roastedBeanName, input.greenBeanName),
      roastLevel: resolveNormalizedRoastLevel(input.roastLevel, input.inputWeightGrams, input.outputWeightGrams),
      id: `local-${Date.now().toString()}`,
      salesMode: input.salesMode ?? 'sale',
      status: input.status ?? 'completed',
      imageUrls: input.imageUrls ?? [],
      createdAt: now,
      updatedAt: now,
    };
    saveLocalBatches(sortBatches([record, ...batches]));
    return Promise.resolve(ok(record));
  }

  deleteBatch(batchId: string) {
    const batches = loadLocalBatches();
    saveLocalBatches(batches.filter((b) => b.id !== batchId));
    return Promise.resolve();
  }

  getBatchById(batchId: string) {
    return Promise.resolve(loadLocalBatches().find((batch) => batch.id === batchId) ?? null);
  }

  listBatches() {
    return Promise.resolve(ok(sortBatches(loadLocalBatches())));
  }

  updateBatch(batchId: string, input: RoastBatchUpdateInput) {
    const batches = loadLocalBatches();
    const index = batches.findIndex((b) => b.id === batchId);
    if (index === -1) {
      throw new AppError('未找到烘焙记录', { code: 'DATA' });
    }
    const currentBatch = getLocalBatchAt(batches, index);
    const updated: RoastBatchRecord = {
      ...currentBatch,
      ...input,
      roastedBeanName: input.roastedBeanName ?? currentBatch.roastedBeanName ?? currentBatch.greenBeanName,
      roastLevel: resolveNormalizedRoastLevel(
        input.roastLevel ?? currentBatch.roastLevel,
        input.inputWeightGrams ?? currentBatch.inputWeightGrams,
        input.outputWeightGrams ?? currentBatch.outputWeightGrams,
      ),
      id: currentBatch.id,
      salesMode: input.salesMode ?? currentBatch.salesMode,
      updatedAt: new Date().toISOString(),
    };
    batches[index] = updated;
    saveLocalBatches(batches);
    return Promise.resolve(ok(updated));
  }
}

class RemoteRoastBatchRepository implements RoastBatchRepository {
  constructor(private readonly client: PocketBaseRestClient = getGreenBeanClient()) {}

  async createBatch(input: RoastBatchCreateInput) {
    const payload = toPocketBaseRoastBatchCreatePayload(input);
    let rows: Record<string, unknown>[];

    try {
      rows = await this.client.insert('roast_batches', payload, { select: '*' });
    } catch (error) {
      if (!isMissingRoastedBeanNameColumnError(error)) {
        throw error;
      }

      logger.warn('roast_batches missing roasted_bean_name column, retrying without it', {
        greenBeanId: input.greenBeanId,
      });
      rows = await this.client.insert('roast_batches', omitRoastedBeanNamePayload(payload), { select: '*' });
    }

    const createdRow = rows[0];

    if (!createdRow) {
      throw new AppError('创建烘焙记录失败：未返回数据。', { code: 'DATA' });
    }

    return ok(mapUnknownRemoteRecord(createdRow));
  }

  async deleteBatch(batchId: string) {
    await this.client.delete('roast_batches', { match: { id: batchId } });
  }

  async getBatchById(batchId: string) {
    try {
      const overviewRows = await this.client.list<Record<string, unknown>>('roast_batch_overview', {
        limit: 1,
        match: { id: batchId },
      });

      const overviewRow = overviewRows[0];

      if (overviewRow && hasOverviewSalesModeField(overviewRow)) {
        return mapUnknownRemoteRecord(overviewRow);
      }
    } catch (overviewError) {
      if (!isMissingRemoteResourceError(overviewError)) {
        throw overviewError;
      }
    }

    const rows = await this.client.list<Record<string, unknown>>('roast_batches', {
      limit: 1,
      match: { id: batchId },
    });

    const batchRow = rows[0];

    return batchRow ? mapUnknownRemoteRecord(batchRow) : null;
  }

  async listBatches() {
    try {
      const rows = await this.client.list<Record<string, unknown>>('roast_batch_overview', {
        orderBy: { ascending: false, column: 'roast_date' },
      });

      if (rows.length === 0 || rows.every(hasOverviewSalesModeField)) {
        return ok(rows.map(mapUnknownRemoteRecord));
      }
    } catch (overviewError) {
      if (!isMissingRemoteResourceError(overviewError)) {
        throw overviewError;
      }
    }

    try {
      const rows = await this.client.list<Record<string, unknown>>('roast_batches', {
        orderBy: { ascending: false, column: 'roast_date' },
      });
      return ok(rows.map(mapUnknownRemoteRecord));
    } catch (tableError) {
      if (isMissingRemoteResourceError(tableError)) {
        return ok([]);
      }

      throw tableError;
    }
  }

  async updateBatch(batchId: string, input: RoastBatchUpdateInput) {
    const payload = toPocketBaseRoastBatchPayload(input);
    let rows: Record<string, unknown>[];

    try {
      rows = await this.client.update('roast_batches', payload, {
        match: { id: batchId },
        select: '*',
      });
    } catch (error) {
      if (!isMissingRoastedBeanNameColumnError(error)) {
        throw error;
      }

      logger.warn('roast_batches missing roasted_bean_name column during update, retrying without it', {
        batchId,
      });
      rows = await this.client.update('roast_batches', omitRoastedBeanNamePayload(payload), {
        match: { id: batchId },
        select: '*',
      });
    }

    const updatedRow = rows[0];

    if (!updatedRow) {
      throw new AppError('更新失败：未找到记录。', { code: 'DATA' });
    }

    return ok(mapUnknownRemoteRecord(updatedRow));
  }
}

export const resolveRoastBatchRepository = (): RoastBatchRepository => {
  if (import.meta.env.MODE === 'test') {
    return new MockRoastBatchRepository();
  }

  if (!hasGreenBeanConnection()) {
    return new MockRoastBatchRepository();
  }
  return new RemoteRoastBatchRepository();
};

export const roastBatchRemoteSync = async (): Promise<{ downloaded: number; uploaded: number }> => {
  const repository = new RemoteRoastBatchRepository();
  const localBatchesBeforeSync = sortBatches(loadLocalBatches());
  const optimisticLocalBatches = localBatchesBeforeSync.filter((batch) => batch.id.startsWith('local-'));
  const syncableLocalBatches = localBatchesBeforeSync.filter((batch) => !batch.id.startsWith('local-'));
  const remoteBeforeSync = await repository.listBatches();
  const remoteIds = new Set(remoteBeforeSync.data.map((batch) => batch.id));
  let uploaded = 0;

  for (const batch of syncableLocalBatches) {
    if (remoteIds.has(batch.id)) {
      continue;
    }

    await repository.createBatch({
      developmentRatio: batch.developmentRatio,
      firstCrackTime: batch.firstCrackTime,
      finalSaleUnitPrice: batch.finalSaleUnitPrice,
      greenBeanId: batch.greenBeanId,
      greenBeanName: batch.greenBeanName,
      imageUrls: batch.imageUrls,
      inputWeightGrams: batch.inputWeightGrams,
      notes: batch.notes,
      outputWeightGrams: batch.outputWeightGrams,
      roastDate: batch.roastDate,
      roastLevel: resolveNormalizedRoastLevel(batch.roastLevel, batch.inputWeightGrams, batch.outputWeightGrams),
      roastPlanId: batch.roastPlanId,
      roastPlanName: batch.roastPlanName,
      roastedBeanName: batch.roastedBeanName,
      salesMode: batch.salesMode,
      status: batch.status,
      totalRoastTime: batch.totalRoastTime,
    });
    uploaded += 1;
  }

  const remoteAfterSync = await repository.listBatches();
  const nextBatches = sortBatches([...optimisticLocalBatches, ...remoteAfterSync.data]);
  const beforeSignature = JSON.stringify(localBatchesBeforeSync.map((batch) => `${batch.id}:${batch.updatedAt}`));
  const afterSignature = JSON.stringify(nextBatches.map((batch) => `${batch.id}:${batch.updatedAt}`));

  saveLocalBatches(nextBatches);

  return {
    downloaded: beforeSignature === afterSignature ? 0 : nextBatches.length,
    uploaded,
  };
};

export const roastBatchCrud = {
  createBatch: async (input: RoastBatchCreateInput, repository: RoastBatchRepository) => {
    const inventoryImpactWeight = getInventoryImpactWeight({
      inputWeightGrams: input.inputWeightGrams,
      status: input.status ?? 'completed',
    });

    try {
      if (inventoryImpactWeight > 0) {
        await beanService.adjustRemainingWeight(input.greenBeanId, inventoryImpactWeight);
      }

      const createdResponse = await repository.createBatch(input);

      if (!roastedCoffeeBeanMirrorService.isEnabled()) {
        saveBatchRecord(createdResponse.data);
        return createdResponse;
      }

      try {
        await roastedCoffeeBeanMirrorService.syncCreatedBatch(createdResponse.data);
      } catch (mirrorError) {
        try {
          await repository.deleteBatch(createdResponse.data.id);
        } catch (rollbackError) {
          logger.error('roast batch mirror rollback failed', {
            batchId: createdResponse.data.id,
            mirrorError,
            rollbackError,
          });

          throw new AppError('烘焙记录主库已创建，但熟豆库同步失败且自动回滚未完成，请立即检查两边数据。', {
            code: 'NETWORK',
            cause: {
              mirrorError,
              rollbackError,
            },
          });
        }

        throw mirrorError;
      }

      saveBatchRecord(createdResponse.data);

      return createdResponse;
    } catch (error) {
      if (inventoryImpactWeight > 0) {
        try {
          await beanService.adjustRemainingWeight(input.greenBeanId, -inventoryImpactWeight);
        } catch (rollbackError) {
          logger.error('roast batch create inventory rollback failed', {
            greenBeanId: input.greenBeanId,
            inventoryImpactWeight,
            rollbackError,
          });

          throw new AppError('烘焙记录创建失败，且库存回滚未完成，请立即核对生豆剩余库存。', {
            code: 'DATA',
            cause: {
              error,
              rollbackError,
            },
          });
        }
      }

      if (error instanceof AppError) throw error;
      throw new AppError('创建烘焙记录失败。', { code: 'NETWORK', cause: error });
    }
  },
  deleteBatch: async (batchId: string, repository: RoastBatchRepository) => {
    const currentBatch = await repository.getBatchById(batchId);

    if (!currentBatch) {
      throw new AppError('未找到烘焙记录', { code: 'DATA' });
    }

    const currentImpactWeight = getInventoryImpactWeight(currentBatch);
    const rollbacks: (() => Promise<unknown>)[] = [];

    if (currentImpactWeight > 0) {
      await beanService.adjustRemainingWeight(currentBatch.greenBeanId, -currentImpactWeight);
      rollbacks.push(() => beanService.adjustRemainingWeight(currentBatch.greenBeanId, currentImpactWeight));
    }

    try {
      await repository.deleteBatch(batchId);
    } catch (error) {
      await rollbackInventoryAdjustments(rollbacks, { batchId, stage: 'delete' });
      throw error;
    }

    removeStoredBatch(batchId);
  },
  updateBatch: async (
    batchId: string,
    input: RoastBatchUpdateInput,
    repository: RoastBatchRepository,
  ) => {
    const currentBatch = await repository.getBatchById(batchId);

    if (!currentBatch) {
      throw new AppError('未找到烘焙记录', { code: 'DATA' });
    }

    const nextBatch = getNextBatchState(currentBatch, input);
    const currentImpactWeight = getInventoryImpactWeight(currentBatch);
    const nextImpactWeight = getInventoryImpactWeight(nextBatch);
    const rollbacks: (() => Promise<unknown>)[] = [];

    if (currentBatch.greenBeanId === nextBatch.greenBeanId) {
      const deltaWeight = nextImpactWeight - currentImpactWeight;

      if (deltaWeight !== 0) {
        await beanService.adjustRemainingWeight(currentBatch.greenBeanId, deltaWeight);
        rollbacks.push(() => beanService.adjustRemainingWeight(currentBatch.greenBeanId, -deltaWeight));
      }
    } else {
      if (currentImpactWeight > 0) {
        await beanService.adjustRemainingWeight(currentBatch.greenBeanId, -currentImpactWeight);
        rollbacks.push(() => beanService.adjustRemainingWeight(currentBatch.greenBeanId, currentImpactWeight));
      }

      try {
        if (nextImpactWeight > 0) {
          await beanService.adjustRemainingWeight(nextBatch.greenBeanId, nextImpactWeight);
          rollbacks.push(() => beanService.adjustRemainingWeight(nextBatch.greenBeanId, -nextImpactWeight));
        }
      } catch (error) {
        await rollbackInventoryAdjustments(rollbacks, { batchId, stage: 'prepare-update' });
        throw error;
      }
    }

    try {
      const response = await repository.updateBatch(batchId, input);
      saveBatchRecord(response.data);
      return response;
    } catch (error) {
      await rollbackInventoryAdjustments(rollbacks, { batchId, stage: 'update' });
      throw error;
    }
  },
};
