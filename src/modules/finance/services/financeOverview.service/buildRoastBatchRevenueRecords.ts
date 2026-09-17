import type { Bean } from '@/types/domain';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import type { CostCalculationRecord, FinanceDateRange } from '../../types';
import { calculateRoastBatchProfit, resolveRoastBatchSaleUnitPrice } from '../financeProfitCalculation.service';
import { buildBeanMap, buildBeanNameMap } from './beanMapUtils';
import { getFinanceDateTextFromTimestamp } from './dateUtils';
import { isDateWithinFinanceRange } from './rangeUtils';

interface RoastBatchRevenueDetail {
  amount: number;
  beanCost: number;
  date: string;
  id: string;
  notes: null | string;
  nonBeanCost: number;
  saleUnitCount: number;
  saleUnitPrice: number;
  shippingCost: number;
  title: string;
}

export const buildRoastBatchRevenueRecords = (
  roastBatches: RoastBatchRecord[],
  beans: Bean[],
  range: FinanceDateRange,
  templatesById: Map<string, CostTemplate>,
  shippingCostByBatchId: Map<string, number>,
  calculations: CostCalculationRecord[] = [],
  fallbackTemplate?: CostTemplate,
): RoastBatchRevenueDetail[] => {
  const beanMap = buildBeanMap(beans);
  const beanNameMap = buildBeanNameMap(beans);
  const calculationByBeanId = new Map<string, CostCalculationRecord>();
  calculations.forEach((calculation) => {
    const current = calculationByBeanId.get(calculation.beanId);
    if (!current || calculation.updatedAt > current.updatedAt) {
      calculationByBeanId.set(calculation.beanId, calculation);
    }
  });

  return roastBatches
    .filter((batch) => {
      const roastDate = getFinanceDateTextFromTimestamp(batch.roastDate);

      return batch.status === 'completed' && batch.salesMode === 'sale' && isDateWithinFinanceRange(roastDate, range);
    })
    .map((batch) => {
      const roastDate = getFinanceDateTextFromTimestamp(batch.roastDate);
      const bean = beanMap.get(batch.greenBeanId) ?? beanNameMap.get(batch.greenBeanName.trim());
      const historicalCalculation = calculationByBeanId.get(batch.greenBeanId);
      const shippingCost = shippingCostByBatchId.get(batch.id) ?? 0;
      const metrics = calculateRoastBatchProfit(
        batch,
        bean,
        templatesById,
        shippingCost,
        historicalCalculation,
        fallbackTemplate,
      );
      const saleUnitPrice = resolveRoastBatchSaleUnitPrice(batch, bean, historicalCalculation?.saleUnitPrice);
      const saleUnitCount = batch.soldUnitCount ?? 1;
      const amount = metrics?.revenue ?? 0;
      const roastedBeanName = batch.roastedBeanName?.trim();

      return {
        amount,
        beanCost: metrics?.beanCost ?? 0,
        date: roastDate,
        id: batch.id,
        notes: batch.notes ?? null,
        nonBeanCost: metrics?.nonBeanCost ?? 0,
        saleUnitCount,
        saleUnitPrice,
        shippingCost,
        title: roastedBeanName && roastedBeanName.length > 0 ? roastedBeanName : batch.greenBeanName,
      };
    })
    .filter((record) => record.amount > 0)
    .sort((left, right) => {
      if (left.date === right.date) {
        return right.id.localeCompare(left.id);
      }

      return right.date.localeCompare(left.date);
    });
};
