import { beanService } from '@/modules/bean/services';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { isPocketBaseProjectConnectionConfigured } from '@/modules/settings/types';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';
import type { ApiResponse } from '@/services/api.types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

import {
  calculateDehydrationRate,
  normalizeRoastLevel,
  resolveRoastLevelFromDehydrationRate,
} from '../../constants/roastLevel';
import type {
  RoastBatchCreateInput,
  RoastBatchRecord,
  RoastBatchUpdateInput,
} from '../../types/roastBatch';

export const ok = <T,>(data: T): ApiResponse<T> => ({
  code: 0,
  data,
  message: 'ok',
});

export const isMissingRemoteResourceError = (error: unknown): boolean => {
  if (!(error instanceof AppError)) {
    return false;
  }

  const cause = error.cause;
  const payload = typeof cause === 'object' && cause != null ? (cause as { code?: string }) : null;

  return error.status === 404 || payload?.code?.startsWith('PGRST') === true;
};

export const isMissingRoastedBeanNameColumnError = (error: unknown): boolean => {
  if (!(error instanceof AppError)) {
    return false;
  }

  const cause = error.cause;
  const payload = typeof cause === 'object' && cause != null ? (cause as { message?: string }) : null;
  const message = payload?.message ?? error.message;

  return message.includes("'roasted_bean_name'") && message.includes("'roast_batches'");
};

export const hasOverviewSalesModeField = (record: Record<string, unknown>): boolean => {
  return Object.prototype.hasOwnProperty.call(record, 'sales_mode');
};

export const getLocalBatchAt = (batches: RoastBatchRecord[], index: number): RoastBatchRecord => {
  const batch = batches[index];

  if (!batch) {
    throw new AppError('未找到烘焙记录', { code: 'DATA' });
  }

  return batch;
};

export const getInventoryImpactWeight = (
  batch: Pick<RoastBatchRecord, 'inputWeightGrams' | 'status'>,
): number => {
  return batch.status === 'draft' ? 0 : batch.inputWeightGrams;
};

export const resolveNormalizedRoastLevel = (
  roastLevel: string | undefined,
  inputWeightGrams: number,
  outputWeightGrams: number,
): string => {
  if (roastLevel == null || roastLevel.trim().length === 0) {
    return resolveRoastLevelFromDehydrationRate(calculateDehydrationRate(inputWeightGrams, outputWeightGrams));
  }

  return normalizeRoastLevel(roastLevel);
};

const toNullableStringValue = (value: string | undefined): null | string => {
  if (value == null || value === '') {
    return null;
  }

  return value;
};

export const resolveRoastedBeanName = (roastedBeanName: string | undefined, greenBeanName: string): string => {
  if (roastedBeanName == null || roastedBeanName === '') {
    return greenBeanName;
  }

  return roastedBeanName;
};

export const rollbackInventoryAdjustments = async (
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

export const getNextBatchState = (
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

export const omitRoastedBeanNamePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const nextPayload = { ...payload };
  delete nextPayload.roasted_bean_name;
  return nextPayload;
};

const getStringField = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const getOptionalStringField = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const getNumberField = (value: unknown, fallback = 0): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const getOptionalNumberField = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const getStringArrayField = (value: unknown): string[] => {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
};

const getBatchStatusField = (value: unknown): RoastBatchRecord['status'] => {
  return value === 'draft' ? 'draft' : 'completed';
};

const getSalesModeField = (value: unknown): RoastBatchRecord['salesMode'] => {
  return value === 'selfUse' ? 'selfUse' : 'sale';
};

export const mapRemoteRoastBatchRecord = (record: Record<string, unknown>): RoastBatchRecord => ({
  id: getStringField(record.id),
  roastDate: getStringField(record.roast_date),
  greenBeanId: getStringField(record.green_bean_id),
  greenBeanName: getStringField(record.green_bean_name),
  roastedBeanName: resolveRoastedBeanName(
    getOptionalStringField(record.roasted_bean_name),
    getStringField(record.green_bean_name),
  ),
  roastPlanId: getOptionalStringField(record.roast_plan_id),
  roastPlanName: getOptionalStringField(record.roast_plan_name),
  inputWeightGrams: getNumberField(record.input_weight_grams),
  outputWeightGrams: getNumberField(record.output_weight_grams),
  roastLevel: resolveNormalizedRoastLevel(
    getOptionalStringField(record.roast_level),
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

export const mapUnknownRemoteRecord = (record: unknown): RoastBatchRecord => {
  return mapRemoteRoastBatchRecord(record as Record<string, unknown>);
};

export const hasGreenBeanConnection = (): boolean => {
  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');

  return isPocketBaseProjectConnectionConfigured(connection);
};

export const getGreenBeanClient = (): PocketBaseRestClient => {
  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');
  return new PocketBaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });
};

export const createInventoryRollback = (beanId: string, deltaWeight: number) => {
  return () => beanService.adjustRemainingWeight(beanId, deltaWeight);
};
