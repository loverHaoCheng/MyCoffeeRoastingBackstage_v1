import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';

import type { GreenBeanCreateInput } from '../../types';
import { normalizeText } from './bean.service.shared';
import type {
  RemotePurchaseBatchRecord,
  RemoteRoastBatchOverviewRecord,
  RemoteSaleSpecRecord,
} from './bean.service.types';

const OPTIONAL_COLLECTIONS = new Set(['app_settings', 'bean_sale_specs', 'roast_batches']);

export const createOptionalCollectionFallback = (collectionName: string, error: unknown): boolean => {
  return (
    OPTIONAL_COLLECTIONS.has(collectionName) &&
    error instanceof AppError &&
    error.code === 'HTTP' &&
    error.status === 404
  );
};

export const withOptionalCollectionFallback = async <T,>(
  collectionName: string,
  operation: string,
  execute: () => Promise<T>,
  fallback: T,
): Promise<T> => {
  try {
    return await execute();
  } catch (error) {
    if (createOptionalCollectionFallback(collectionName, error)) {
      logger.warn('bean repository optional collection unavailable', {
        collectionName,
        error,
        operation,
      });
      return fallback;
    }

    throw error;
  }
};

export const buildBeanAggregationMaps = (
  purchaseBatches: RemotePurchaseBatchRecord[],
  saleSpecs: RemoteSaleSpecRecord[],
  roastBatches: RemoteRoastBatchOverviewRecord[],
) => {
  const purchaseBatchMap = new Map<string, RemotePurchaseBatchRecord[]>();
  const saleSpecMap = new Map<string, RemoteSaleSpecRecord[]>();
  const roastBatchMap = new Map<string, RemoteRoastBatchOverviewRecord[]>();

  purchaseBatches.forEach((batch) => {
    if (!batch.green_bean_id) return;
    purchaseBatchMap.set(batch.green_bean_id, [...(purchaseBatchMap.get(batch.green_bean_id) ?? []), batch]);
  });
  saleSpecs.forEach((saleSpec) => {
    if (!saleSpec.green_bean_id) return;
    saleSpecMap.set(saleSpec.green_bean_id, [...(saleSpecMap.get(saleSpec.green_bean_id) ?? []), saleSpec]);
  });
  roastBatches.forEach((roastBatch) => {
    roastBatchMap.set(roastBatch.green_bean_id, [...(roastBatchMap.get(roastBatch.green_bean_id) ?? []), roastBatch]);
  });

  return {
    purchaseBatchMap,
    roastBatchMap,
    saleSpecMap,
  };
};

export const createGreenBeanInsertPayload = (
  input: GreenBeanCreateInput,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    aging_days: Math.max(0, Math.round(input.agingDays)),
    code: input.code.trim(),
    default_roast_input_grams: input.defaultRoastInputGrams,
    display_name: input.displayName.trim(),
    flavor_tags: input.flavorTags.join(','),
    grade: normalizeText(input.grade),
    harvest_season: normalizeText(input.harvestSeason),
    notes: normalizeText(input.notes),
    origin_area: normalizeText(input.originArea),
    origin_country: normalizeText(input.originCountry),
    origin_region: normalizeText(input.originRegion),
    process_method: input.processMethod.trim(),
    tasting_end_days: Math.max(1, Math.round(input.tastingEndDays)),
    variety: input.variety.trim(),
  };

  if (input.altitudeMetersMin != null) {
    payload.altitude_meters_min = input.altitudeMetersMin;
  }
  if (input.altitudeMetersMax != null) {
    payload.altitude_meters_max = input.altitudeMetersMax;
  }
  if (input.moisturePercent != null) {
    payload.moisture_percent = input.moisturePercent;
  }
  if (input.densityGPerL != null) {
    payload.density_g_per_l = input.densityGPerL;
  }
  if (normalizeText(input.millName) != null) {
    payload.mill_name = normalizeText(input.millName);
  }

  return payload;
};
