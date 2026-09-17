import { useMemo } from 'react';
import {
  buildCostTemplateById,
  buildReservedShippingUnitCountByBatchId,
  calculateRoastSaleCapacity,
  resolveBeanCostTemplate,
} from '@/modules/finance/services/financeProfitCalculation.service';
import type { FinanceExpenseRecord } from '@/modules/finance/types';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import type { Bean } from '@/types/domain';

export interface ShippingBatchOption {
  batch: RoastBatchRecord;
  availableUnitCount: number;
}

export const useShippingBatchOptions = (
  beans: Bean[],
  roastBatches: RoastBatchRecord[],
  expenseRecords: FinanceExpenseRecord[],
  templates: CostTemplate[],
): ShippingBatchOption[] => {
  return useMemo<ShippingBatchOption[]>(() => {
    const beansById = new Map(beans.map((bean) => [String(bean.id), bean]));
    const templatesById = buildCostTemplateById(templates);
    const reservedUnitCountByBatchId = buildReservedShippingUnitCountByBatchId(expenseRecords);

    return roastBatches.flatMap((batch) => {
      if (batch.salesMode !== 'sale' || batch.status !== 'completed') {
        return [];
      }

      const bean = beansById.get(batch.greenBeanId);
      const template = bean ? resolveBeanCostTemplate(bean, templatesById) : null;

      if (!template) {
        return [];
      }

      const maximumUnitCount = calculateRoastSaleCapacity(batch.inputWeightGrams, template).maximumSoldUnitCount;
      const availableUnitCount = maximumUnitCount - (reservedUnitCountByBatchId.get(batch.id) ?? 0);

      return availableUnitCount > 0 ? [{ batch, availableUnitCount }] : [];
    });
  }, [beans, expenseRecords, roastBatches, templates]);
};
