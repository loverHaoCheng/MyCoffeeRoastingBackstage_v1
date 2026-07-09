import { beanService } from '@/modules/bean/services';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { isPocketBaseProjectConnectionConfigured } from '@/modules/settings/types';
import { AppError } from '@/shared/errors/AppError';
import type { ApiResponse } from '@/services/api.types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';
import { logger } from '@/shared/logger/logger';

import {
  calculateDehydrationRate,
  normalizeRoastLevel,
  resolveRoastLevelFromDehydrationRate,
} from '../constants/roastLevel';
import type {
  RoastBatchCreateInput,
  RoastBatchRecord,
  RoastBatchUpdateInput,
} from '../types/roastBatch';
import { roastedCoffeeBeanMirrorService } from './roastedCoffeeBeanMirror.service';

// ============ Repository 接口 ============

export interface RoastBatchRepository {
  createBatch(input: RoastBatchCreateInput): Promise<ApiResponse<RoastBatchRecord>>;
  deleteBatch(batchId: string): Promise<void>;
  getBatchById(batchId: string): Promise<null | RoastBatchRecord>;
  listBatches(): Promise<ApiResponse<RoastBatchRecord[]>>;
  updateBatch(batchId: string, input: RoastBatchUpdateInput): Promise<ApiResponse<RoastBatchRecord>>;
}

// ============ 本地存储键 ============

const STORAGE_KEY = 'coffee-roasting-backstage:roast-batches';
let localRoastBatches: RoastBatchRecord[] = [];
const pendingOptimisticCreateBatchIds = new Set<string>();

const loadLocalBatches = (): RoastBatchRecord[] => {
  void STORAGE_KEY;
  return sortBatches(localRoastBatches.map(normalizeStoredBatch));
};

const saveLocalBatches = (batches: RoastBatchRecord[]): void => {
  localRoastBatches = sortBatches(batches);
};

const createOptimisticLocalBatchId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const isOptimisticLocalBatchId = (batchId: string): boolean => {
  return batchId.startsWith('local-');
};

// ============ 工具函数 ============

const ok = <T,>(data: T): ApiResponse<T> => ({
  code: 0,
  data,
  message: 'ok',
});

const sortBatches = (batches: RoastBatchRecord[]): RoastBatchRecord[] => {
  return [...batches].sort((a, b) => {
    return new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime();
  });
};

const getBatchSyncSnapshot = (batches: RoastBatchRecord[]): string => {
  return JSON.stringify(
    [...batches]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((batch) => `${batch.id}:${batch.updatedAt}`),
  );
};

const isMissingRemoteResourceError = (error: unknown): boolean => {
  if (!(error instanceof AppError)) {
    return false;
  }

  const cause = error.cause;
  const payload = typeof cause === 'object' && cause != null ? (cause as { code?: string }) : null;

  return error.status === 404 || payload?.code?.startsWith('PGRST') === true;
};

const isMissingRoastedBeanNameColumnError = (error: unknown): boolean => {
  if (!(error instanceof AppError)) {
    return false;
  }

  const cause = error.cause;
  const payload = typeof cause === 'object' && cause != null ? (cause as { message?: string }) : null;
  const message = payload?.message ?? error.message;

  return message.includes("'roasted_bean_name'") && message.includes("'roast_batches'");
};

const mapUnknownRemoteRecord = (record: unknown): RoastBatchRecord => {
  return mapRemoteRoastBatchRecord(record as Record<string, unknown>);
};

const hasOverviewSalesModeField = (record: Record<string, unknown>): boolean => {
  return Object.prototype.hasOwnProperty.call(record, 'sales_mode');
};

const getLocalBatchAt = (batches: RoastBatchRecord[], index: number): RoastBatchRecord => {
  const batch = batches[index];

  if (!batch) {
    throw new AppError('未找到烘焙记录', { code: 'DATA' });
  }

  return batch;
};

const getInventoryImpactWeight = (
  batch: Pick<RoastBatchRecord, 'inputWeightGrams' | 'status'>,
): number => {
  return batch.status === 'draft' ? 0 : batch.inputWeightGrams;
};

const normalizeStoredBatch = (batch: RoastBatchRecord): RoastBatchRecord => ({
  ...batch,
  roastLevel: resolveNormalizedRoastLevel(batch.roastLevel, batch.inputWeightGrams, batch.outputWeightGrams),
});

const resolveNormalizedRoastLevel = (
  roastLevel: string | undefined,
  inputWeightGrams: number,
  outputWeightGrams: number,
): string => {
  if (roastLevel == null || roastLevel.trim().length === 0) {
    return resolveRoastLevelFromDehydrationRate(calculateDehydrationRate(inputWeightGrams, outputWeightGrams));
  }

  return normalizeRoastLevel(roastLevel);
};

const saveBatchRecord = (record: RoastBatchRecord): void => {
  const batches = loadLocalBatches().filter((batch) => batch.id !== record.id);
  saveLocalBatches(sortBatches([normalizeStoredBatch(record), ...batches.map(normalizeStoredBatch)]));
};

const removeStoredBatch = (batchId: string): void => {
  saveLocalBatches(loadLocalBatches().filter((batch) => batch.id !== batchId));
};

const restoreStoredBatch = (batch: RoastBatchRecord): void => {
  saveLocalBatches([batch, ...loadLocalBatches().filter((item) => item.id !== batch.id)]);
};

const toNullableStringValue = (value: string | undefined): null | string => {
  if (value == null || value === '') {
    return null;
  }

  return value;
};

const resolveRoastedBeanName = (roastedBeanName: string | undefined, greenBeanName: string): string => {
  if (roastedBeanName == null || roastedBeanName === '') {
    return greenBeanName;
  }

  return roastedBeanName;
};

const rollbackInventoryAdjustments = async (
  rollbacks: (() => Promise<unknown>)[],
  context: Record<string, unknown>,
): Promise<void> => {
  const rollbackErrors: unknown[] = [];

  for (let index = rollbacks.length - 1; index >= 0; index -= 1) {
    const rollback = rollbacks[index];

    if (!rollback) {
      continue;
    }

    try {
      await rollback();
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
  }

  if (rollbackErrors.length === 0) {
    return;
  }

  logger.error('roast batch inventory rollback failed', {
    ...context,
    rollbackErrors,
  });

  throw new AppError('烘焙记录库存回滚失败，请立即核对生豆库存与烘焙历史。', {
    code: 'DATA',
    cause: rollbackErrors,
  });
};

const getNextBatchState = (
  currentBatch: RoastBatchRecord,
  input: RoastBatchUpdateInput,
): RoastBatchRecord => ({
  ...currentBatch,
  ...input,
  roastedBeanName: input.roastedBeanName ?? currentBatch.roastedBeanName ?? currentBatch.greenBeanName,
  roastLevel: resolveNormalizedRoastLevel(
    input.roastLevel ?? currentBatch.roastLevel,
    input.inputWeightGrams ?? currentBatch.inputWeightGrams,
    input.outputWeightGrams ?? currentBatch.outputWeightGrams,
  ),
  salesMode: input.salesMode ?? currentBatch.salesMode,
  status: input.status ?? currentBatch.status,
});

// ============ PocketBase 字段映射 ============

export const toPocketBaseRoastBatchPayload = (
  input: RoastBatchCreateInput | RoastBatchUpdateInput,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  if (input.roastDate !== undefined) payload.roast_date = input.roastDate;
  if (input.greenBeanId !== undefined) payload.green_bean_id = input.greenBeanId;
  if (input.greenBeanName !== undefined) payload.green_bean_name = input.greenBeanName;
  if (input.roastedBeanName !== undefined) {
    payload.roasted_bean_name = toNullableStringValue(input.roastedBeanName);
  }
  if (input.roastPlanId !== undefined) payload.roast_plan_id = toNullableStringValue(input.roastPlanId);
  if (input.roastPlanName !== undefined) payload.roast_plan_name = toNullableStringValue(input.roastPlanName);
  if (input.inputWeightGrams !== undefined) payload.input_weight_grams = input.inputWeightGrams;
  if (input.outputWeightGrams !== undefined) payload.output_weight_grams = input.outputWeightGrams;
  if (input.roastLevel !== undefined) payload.roast_level = normalizeRoastLevel(input.roastLevel);
  if (input.developmentRatio !== undefined) payload.development_ratio = input.developmentRatio;
  if (input.firstCrackTime !== undefined) payload.first_crack_time = input.firstCrackTime;
  if (input.totalRoastTime !== undefined) payload.total_roast_time = input.totalRoastTime;
  if (input.notes !== undefined) payload.notes = toNullableStringValue(input.notes);
  if (input.imageUrls !== undefined) payload.image_urls = input.imageUrls ?? [];
  if (input.salesMode !== undefined) payload.sales_mode = input.salesMode;
  if (input.status !== undefined) payload.status = input.status;

  return payload;
};

export const toPocketBaseRoastBatchCreatePayload = (input: RoastBatchCreateInput): Record<string, unknown> => {
  return toPocketBaseRoastBatchPayload({
    ...input,
    status: input.status ?? 'completed',
  });
};

const omitRoastedBeanNamePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const nextPayload = { ...payload };

  delete nextPayload.roasted_bean_name;

  return nextPayload;
};

const getStringField = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const getOptionalStringField = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const getNumberField = (value: unknown, fallback = 0): number => {
  return typeof value === 'number' ? value : fallback;
};

const getOptionalNumberField = (value: unknown): number | undefined => {
  return typeof value === 'number' ? value : undefined;
};

const getStringArrayField = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      return [];
    }

    items.push(item);
  }

  return items;
};

const getBatchStatusField = (value: unknown): RoastBatchRecord['status'] => {
  return value === 'draft' || value === 'completed' ? value : 'completed';
};

const getSalesModeField = (value: unknown): RoastBatchRecord['salesMode'] => {
  return value === 'selfUse' ? 'selfUse' : 'sale';
};

const mapRemoteRoastBatchRecord = (record: Record<string, unknown>): RoastBatchRecord => ({
  id: getStringField(record.id),
  roastDate: getStringField(record.roast_date),
  greenBeanId: getStringField(record.green_bean_id),
  greenBeanName: getStringField(record.green_bean_name),
  roastedBeanName: getOptionalStringField(record.roasted_bean_name),
  roastPlanId: getOptionalStringField(record.roast_plan_id),
  roastPlanName: getOptionalStringField(record.roast_plan_name),
  inputWeightGrams: getNumberField(record.input_weight_grams),
  outputWeightGrams: getNumberField(record.output_weight_grams),
  roastLevel: resolveNormalizedRoastLevel(
    getStringField(record.roast_level),
    getNumberField(record.input_weight_grams),
    getNumberField(record.output_weight_grams),
  ),
  developmentRatio: getOptionalNumberField(record.development_ratio),
  firstCrackTime: getOptionalNumberField(record.first_crack_time),
  totalRoastTime: getOptionalNumberField(record.total_roast_time),
  notes: getOptionalStringField(record.notes),
  imageUrls: getStringArrayField(record.image_urls),
  salesMode: getSalesModeField(record.sales_mode),
  status: getBatchStatusField(record.status),
  createdAt: getStringField(record.created_at),
  updatedAt: getStringField(record.updated_at),
});

// ============ 连接检测 ============

const hasGreenBeanConnection = (): boolean => {
  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');
  return isPocketBaseProjectConnectionConfigured(connection);
};

const getGreenBeanClient = (): PocketBaseRestClient => {
  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');
  return new PocketBaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });
};

// ============ Mock Repository ============

class MockRoastBatchRepository implements RoastBatchRepository {
  createBatch(input: RoastBatchCreateInput): Promise<ApiResponse<RoastBatchRecord>> {
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

  deleteBatch(batchId: string): Promise<void> {
    const batches = loadLocalBatches();
    saveLocalBatches(batches.filter((b) => b.id !== batchId));
    return Promise.resolve();
  }

  getBatchById(batchId: string): Promise<null | RoastBatchRecord> {
    return Promise.resolve(loadLocalBatches().find((batch) => batch.id === batchId) ?? null);
  }

  listBatches(): Promise<ApiResponse<RoastBatchRecord[]>> {
    return Promise.resolve(ok(sortBatches(loadLocalBatches())));
  }

  updateBatch(batchId: string, input: RoastBatchUpdateInput): Promise<ApiResponse<RoastBatchRecord>> {
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

// ============ Remote Repository ============

class RemoteRoastBatchRepository implements RoastBatchRepository {
  constructor(private readonly client: PocketBaseRestClient) {}

  async createBatch(input: RoastBatchCreateInput): Promise<ApiResponse<RoastBatchRecord>> {
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

  async deleteBatch(batchId: string): Promise<void> {
    await this.client.delete('roast_batches', { match: { id: batchId } });
  }

  async getBatchById(batchId: string): Promise<null | RoastBatchRecord> {
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

  async listBatches(): Promise<ApiResponse<RoastBatchRecord[]>> {
    // 优先从视图查询（如有），否则查表；两者都缺失时安静降级为空列表。
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

  async updateBatch(batchId: string, input: RoastBatchUpdateInput): Promise<ApiResponse<RoastBatchRecord>> {
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

// ============ Repository 解析 ============

const resolveRoastBatchRepository = (): RoastBatchRepository => {
  if (import.meta.env.MODE === 'test') {
    return new MockRoastBatchRepository();
  }

  if (!hasGreenBeanConnection()) {
    return new MockRoastBatchRepository();
  }
  return new RemoteRoastBatchRepository(getGreenBeanClient());
};

// ============ Service ============

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
    const repository = resolveRoastBatchRepository();
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

  async deleteBatch(batchId: string): Promise<void> {
    try {
      const repository = resolveRoastBatchRepository();
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
      const repository = resolveRoastBatchRepository();
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

    const repository = new RemoteRoastBatchRepository(getGreenBeanClient());
    const localBatchesBeforeSync = sortBatches(loadLocalBatches());
    const optimisticLocalBatches = localBatchesBeforeSync.filter((batch) => isOptimisticLocalBatchId(batch.id));
    const syncableLocalBatches = localBatchesBeforeSync.filter((batch) => !isOptimisticLocalBatchId(batch.id));
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
    const beforeSignature = getBatchSyncSnapshot(localBatchesBeforeSync);
    const afterSignature = getBatchSyncSnapshot(nextBatches);

    saveLocalBatches(nextBatches);

    return {
      downloaded: beforeSignature === afterSignature ? 0 : nextBatches.length,
      uploaded,
    };
  },
  hasPendingOptimisticCreations(): boolean {
    return pendingOptimisticCreateBatchIds.size > 0;
  },
};
