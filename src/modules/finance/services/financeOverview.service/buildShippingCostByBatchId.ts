import type { FinanceDateRange, FinanceExpenseRecord } from '../../types';
import { isDateWithinFinanceRange } from './rangeUtils';

export const buildShippingCostByBatchId = (
  expenseRecords: FinanceExpenseRecord[],
  range: FinanceDateRange,
): Map<string, number> => {
  const shippingCostByBatchId = new Map<string, number>();

  expenseRecords.forEach((record) => {
    if (
      record.category !== 'shipping' ||
      record.status !== 'paid' ||
      !isDateWithinFinanceRange(record.expenseDate, range) ||
      (record.roastBatchIds?.length ?? 0) === 0
    ) {
      return;
    }

    const batchIds = record.roastBatchIds ?? [];
    const costPerBatch = record.amount / batchIds.length;

    batchIds.forEach((batchId) => {
      shippingCostByBatchId.set(batchId, (shippingCostByBatchId.get(batchId) ?? 0) + costPerBatch);
    });
  });

  return shippingCostByBatchId;
};
