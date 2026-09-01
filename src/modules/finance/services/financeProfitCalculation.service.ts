import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import type { Bean } from '@/types/domain';

import type { FinanceExpenseRecord } from '../types';
import type { CostCalculationRecord } from '../types';

export interface FinanceProfitMetrics {
  beanCost: number;
  nonBeanCost: number;
  plannedBatchCount: number;
  profit: number;
  revenue: number;
  saleUnitCount: number;
  shippingCost: number;
}

export interface RoastSaleCapacity {
  maximumSoldUnitCount: number;
  roastedWeightGrams: number;
  saleUnitCountPerBatch: number;
}

export interface RoastBatchSaleSnapshot {
  beanCostPerSaleUnit: number;
  nonBeanCostPerSaleUnit: number;
  saleUnitPrice: number;
}

export const buildRoastBatchSaleSnapshotFromCalculation = (
  calculation: CostCalculationRecord,
): RoastBatchSaleSnapshot | null => {
  const saleUnitCount = Math.max(1, calculation.saleUnitCount);

  if (!Number.isFinite(calculation.greenBeanCost) || !Number.isFinite(calculation.saleUnitPrice)) {
    return null;
  }

  return {
    beanCostPerSaleUnit: calculation.greenBeanCost / saleUnitCount,
    nonBeanCostPerSaleUnit:
      (calculation.packagingCost + calculation.energyCost + calculation.otherCost) / saleUnitCount,
    saleUnitPrice: calculation.saleUnitPrice,
  };
};

const toMoney = (value: number): number => Number(value.toFixed(2));

const getRemainingWeightGrams = (bean: Bean): number => {
  return bean.remainingWeightGrams ?? bean.stockKg * 1000;
};

const getNonBeanCostPerUnit = (template: CostTemplate): number => {
  return template.packagingCost + template.energyCost + template.otherCost;
};

const getBeanCostPerUnit = (bean: Bean, template: CostTemplate): number => {
  return bean.costPerKg * (template.roastInputWeightGrams / 1000);
};

export const buildCostTemplateById = (templates: CostTemplate[]): Map<string, CostTemplate> => {
  return new Map(templates.map((template) => [template.id, template]));
};

export const resolveBeanCostTemplate = (
  bean: Bean,
  templatesById: Map<string, CostTemplate>,
): CostTemplate | null => {
  const templateId = bean.costTemplateId;

  return templateId ? templatesById.get(templateId) ?? null : null;
};

export const buildReservedShippingUnitCountByBatchId = (
  expenseRecords: FinanceExpenseRecord[],
): Map<string, number> => {
  return expenseRecords.reduce((reservedUnitCountByBatchId, record) => {
    if (record.category !== 'shipping') {
      return reservedUnitCountByBatchId;
    }

    (record.roastBatchIds ?? []).forEach((batchId) => {
      reservedUnitCountByBatchId.set(batchId, (reservedUnitCountByBatchId.get(batchId) ?? 0) + 1);
    });

    return reservedUnitCountByBatchId;
  }, new Map<string, number>());
};

export const resolveEffectiveSaleUnitPrice = (
  bean: Bean | undefined,
  saleUnitPriceOverride?: number | null,
): number => {
  if (saleUnitPriceOverride != null && saleUnitPriceOverride > 0) {
    return saleUnitPriceOverride;
  }

  return bean?.defaultSaleUnitPrice ?? 0;
};

const getSnapshotNumber = (value: number | null | undefined): number | null => {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
};

const areSaleSnapshotsAllZero = (batch: RoastBatchRecord): boolean => {
  return batch.saleUnitPriceSnapshot === 0 &&
    batch.beanCostPerSaleUnitSnapshot === 0 &&
    batch.nonBeanCostPerSaleUnitSnapshot === 0;
};

export const buildRoastBatchSaleSnapshot = (
  bean: Bean,
  template: CostTemplate,
  saleUnitPriceOverride?: number | null,
): RoastBatchSaleSnapshot | null => {
  const saleUnitPrice = resolveEffectiveSaleUnitPrice(bean, saleUnitPriceOverride);

  if (saleUnitPrice <= 0) {
    return null;
  }

  return {
    beanCostPerSaleUnit: getBeanCostPerUnit(bean, template),
    nonBeanCostPerSaleUnit: getNonBeanCostPerUnit(template),
    saleUnitPrice,
  };
};

export const resolveRoastBatchSaleUnitPrice = (
  batch: RoastBatchRecord,
  bean: Bean | undefined,
  fallbackSaleUnitPrice?: number,
): number => {
  const snapshotPrice = getSnapshotNumber(batch.saleUnitPriceSnapshot);

  if (snapshotPrice != null && snapshotPrice > 0) {
    return snapshotPrice;
  }

  const effectiveSaleUnitPrice = resolveEffectiveSaleUnitPrice(bean, batch.finalSaleUnitPrice);

  return effectiveSaleUnitPrice > 0
    ? effectiveSaleUnitPrice
    : fallbackSaleUnitPrice != null && fallbackSaleUnitPrice > 0
      ? fallbackSaleUnitPrice
      : 0;
};

export const calculateRoastSaleCapacity = (
  inputWeightGrams: number,
  template: CostTemplate,
): RoastSaleCapacity => {
  const roastedWeightGrams = inputWeightGrams * (1 - template.dehydrationRate / 100);
  const saleUnitCountPerBatch = Math.floor(roastedWeightGrams / template.saleUnitWeightGrams);

  return {
    maximumSoldUnitCount: saleUnitCountPerBatch,
    roastedWeightGrams,
    saleUnitCountPerBatch,
  };
};

const calculateProfitMetrics = (
  bean: Bean,
  template: CostTemplate,
  saleUnitCount: number,
  plannedBatchCount: number,
  shippingCost = 0,
  saleUnitPriceOverride?: number | null,
): FinanceProfitMetrics | null => {
  const saleUnitPrice = resolveEffectiveSaleUnitPrice(bean, saleUnitPriceOverride);

  if (saleUnitCount <= 0 || saleUnitPrice <= 0) {
    return null;
  }

  const revenue = saleUnitCount * saleUnitPrice;
  const beanCost = saleUnitCount * getBeanCostPerUnit(bean, template);
  const nonBeanCost = saleUnitCount * getNonBeanCostPerUnit(template);

  return {
    beanCost: toMoney(beanCost),
    plannedBatchCount,
    nonBeanCost: toMoney(nonBeanCost),
    profit: toMoney(revenue - beanCost - nonBeanCost - shippingCost),
    revenue: toMoney(revenue),
    saleUnitCount,
    shippingCost: toMoney(shippingCost),
  };
};

const calculateProfitMetricsFromUnitCosts = (
  saleUnitPrice: number,
  beanCostPerSaleUnit: number,
  nonBeanCostPerSaleUnit: number,
  saleUnitCount: number,
  shippingCost = 0,
): FinanceProfitMetrics | null => {
  if (saleUnitCount <= 0 || saleUnitPrice <= 0) {
    return null;
  }

  const revenue = saleUnitCount * saleUnitPrice;
  const beanCost = saleUnitCount * beanCostPerSaleUnit;
  const nonBeanCost = saleUnitCount * nonBeanCostPerSaleUnit;

  return {
    beanCost: toMoney(beanCost),
    plannedBatchCount: 1,
    nonBeanCost: toMoney(nonBeanCost),
    profit: toMoney(revenue - beanCost - nonBeanCost - shippingCost),
    revenue: toMoney(revenue),
    saleUnitCount,
    shippingCost: toMoney(shippingCost),
  };
};

export const calculateEstimatedBeanProfit = (
  bean: Bean,
  templatesById: Map<string, CostTemplate>,
): FinanceProfitMetrics | null => {
  const template = resolveBeanCostTemplate(bean, templatesById);
  const remainingWeightGrams = getRemainingWeightGrams(bean);

  if (!template || remainingWeightGrams <= 0 || template.roastInputWeightGrams <= 0) {
    return null;
  }

  const plannedBatchCount = Math.floor(remainingWeightGrams / template.roastInputWeightGrams);
  const capacity = calculateRoastSaleCapacity(template.roastInputWeightGrams, template);
  const saleUnitCount = plannedBatchCount * capacity.saleUnitCountPerBatch;

  return calculateProfitMetrics(bean, template, saleUnitCount, plannedBatchCount);
};

export const calculateRoastBatchProfit = (
  batch: RoastBatchRecord,
  bean: Bean | undefined,
  templatesById: Map<string, CostTemplate>,
  shippingCost = 0,
  historicalCalculation?: CostCalculationRecord,
  fallbackTemplate?: CostTemplate,
): FinanceProfitMetrics | null => {
  if (batch.salesMode !== 'sale' || batch.status !== 'completed') {
    return null;
  }

  const template = bean ? resolveBeanCostTemplate(bean, templatesById) ?? fallbackTemplate ?? null : null;
  const allZeroSnapshots = areSaleSnapshotsAllZero(batch);
  const snapshotBeanCost = allZeroSnapshots ? null : getSnapshotNumber(batch.beanCostPerSaleUnitSnapshot);
  const snapshotNonBeanCost = allZeroSnapshots ? null : getSnapshotNumber(batch.nonBeanCostPerSaleUnitSnapshot);
  const legacyBeanCost = bean && template ? getBeanCostPerUnit(bean, template) : null;
  const legacyNonBeanCost = template ? getNonBeanCostPerUnit(template) : null;
  const calculationSnapshot = historicalCalculation
    ? buildRoastBatchSaleSnapshotFromCalculation(historicalCalculation)
    : null;
  const beanCostPerSaleUnit = snapshotBeanCost ??
    (allZeroSnapshots
      ? calculationSnapshot?.beanCostPerSaleUnit ?? legacyBeanCost
      : legacyBeanCost ?? calculationSnapshot?.beanCostPerSaleUnit) ?? null;
  const nonBeanCostPerSaleUnit = snapshotNonBeanCost ??
    (allZeroSnapshots
      ? calculationSnapshot?.nonBeanCostPerSaleUnit ?? legacyNonBeanCost
      : legacyNonBeanCost ?? calculationSnapshot?.nonBeanCostPerSaleUnit) ?? null;

  if (beanCostPerSaleUnit == null || nonBeanCostPerSaleUnit == null) {
    return null;
  }

  const saleUnitCount = batch.soldUnitCount ?? 1;

  // 注意：不再因 saleUnitCount 超过模板理论容量而剔除整个批次。
  // 成本模板事后被调整（脱水率/单份克重变化）会使历史批次“超容量”，
  // 此时仍按实际售出份数计算收入与成本，避免财务总览静默漏算。
  return calculateProfitMetricsFromUnitCosts(
    resolveRoastBatchSaleUnitPrice(batch, bean, calculationSnapshot?.saleUnitPrice),
    beanCostPerSaleUnit,
    nonBeanCostPerSaleUnit,
    saleUnitCount,
    shippingCost,
  );
};
