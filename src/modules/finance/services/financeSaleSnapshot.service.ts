import type { RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import type { Bean } from '@/types/domain';
import type { CostCalculationRecord } from '../types';

import {
  buildRoastBatchSaleSnapshot,
  buildRoastBatchSaleSnapshotFromCalculation,
  resolveBeanCostTemplate,
} from './financeProfitCalculation.service';

const hasSnapshotCost = (value: number | null | undefined): value is number => {
  return value != null && Number.isFinite(value) && value >= 0;
};

const hasSnapshotPrice = (value: number | null | undefined): value is number => {
  return hasSnapshotCost(value) && value > 0;
};

const areSaleSnapshotsAllZero = (batch: RoastBatchRecord): boolean => {
  return batch.saleUnitPriceSnapshot === 0 &&
    batch.beanCostPerSaleUnitSnapshot === 0 &&
    batch.nonBeanCostPerSaleUnitSnapshot === 0;
};

export const buildHistoricalSaleSnapshotUpdate = (
  batch: RoastBatchRecord,
  bean: Bean | undefined,
  templatesById: Map<string, CostTemplate>,
  historicalCalculation?: CostCalculationRecord,
  fallbackTemplate?: CostTemplate,
): RoastBatchUpdateInput | null => {
  const allZeroSnapshots = areSaleSnapshotsAllZero(batch);

  if (batch.status !== 'completed' || batch.salesMode !== 'sale') {
    return null;
  }

  if (
    !allZeroSnapshots &&
    hasSnapshotPrice(batch.saleUnitPriceSnapshot) &&
    hasSnapshotCost(batch.beanCostPerSaleUnitSnapshot) &&
    hasSnapshotCost(batch.nonBeanCostPerSaleUnitSnapshot)
  ) {
    return null;
  }

  const template = bean ? resolveBeanCostTemplate(bean, templatesById) ?? fallbackTemplate ?? null : null;
  const calculationSnapshot = historicalCalculation
    ? buildRoastBatchSaleSnapshotFromCalculation(historicalCalculation)
    : null;
  const currentSnapshot = bean && template
    ? buildRoastBatchSaleSnapshot(bean, template, batch.finalSaleUnitPrice)
    : null;
  const snapshot = (allZeroSnapshots ? calculationSnapshot ?? currentSnapshot : currentSnapshot ?? calculationSnapshot);

  if (!snapshot) {
    return null;
  }

  const saleUnitPrice = batch.finalSaleUnitPrice != null && batch.finalSaleUnitPrice > 0
    ? batch.finalSaleUnitPrice
    : snapshot.saleUnitPrice;

  return {
    beanCostPerSaleUnitSnapshot: !allZeroSnapshots && hasSnapshotCost(batch.beanCostPerSaleUnitSnapshot)
      ? batch.beanCostPerSaleUnitSnapshot
      : snapshot.beanCostPerSaleUnit,
    nonBeanCostPerSaleUnitSnapshot: !allZeroSnapshots && hasSnapshotCost(batch.nonBeanCostPerSaleUnitSnapshot)
      ? batch.nonBeanCostPerSaleUnitSnapshot
      : snapshot.nonBeanCostPerSaleUnit,
    saleUnitPriceSnapshot: !allZeroSnapshots && hasSnapshotPrice(batch.saleUnitPriceSnapshot)
      ? batch.saleUnitPriceSnapshot
      : saleUnitPrice,
  };
};
