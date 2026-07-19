import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import type { Bean } from '@/types/domain';

import type { FinanceExpenseRecord } from '../types';

export interface FinanceProfitMetrics {
  beanCost: number;
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
): FinanceProfitMetrics | null => {
  const saleUnitPrice = bean.defaultSaleUnitPrice ?? 0;

  if (saleUnitCount <= 0 || saleUnitPrice <= 0) {
    return null;
  }

  const revenue = saleUnitCount * (saleUnitPrice - getNonBeanCostPerUnit(template));
  const beanCost = saleUnitCount * getBeanCostPerUnit(bean, template);

  return {
    beanCost: toMoney(beanCost),
    plannedBatchCount,
    profit: toMoney(revenue - beanCost - shippingCost),
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
): FinanceProfitMetrics | null => {
  if (batch.salesMode !== 'sale' || batch.status !== 'completed' || !bean) {
    return null;
  }

  const template = resolveBeanCostTemplate(bean, templatesById);

  if (!template) {
    return null;
  }

  const capacity = calculateRoastSaleCapacity(batch.inputWeightGrams, template);
  const saleUnitCount = batch.soldUnitCount ?? 1;

  if (saleUnitCount > capacity.maximumSoldUnitCount) {
    return null;
  }

  return calculateProfitMetrics(bean, template, saleUnitCount, 1, shippingCost);
};
