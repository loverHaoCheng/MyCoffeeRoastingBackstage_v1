import type { Bean } from '@/types/domain';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import { buildCostTemplateById, calculateEstimatedBeanProfit } from './financeProfitCalculation.service';
import { buildExpenseDrilldown } from './financeOverview.service/buildExpenseDrilldown';
import { buildInventoryDrilldown } from './financeOverview.service/buildInventoryDrilldown';
import { buildRealizedDrilldown } from './financeOverview.service/buildRealizedDrilldown';
import { buildRoastBatchRevenueRecords } from './financeOverview.service/buildRoastBatchRevenueRecords';
import { buildShippingCostByBatchId } from './financeOverview.service/buildShippingCostByBatchId';
import { getFinanceDateTextFromTimestamp } from './financeOverview.service/dateUtils';
import { toMoney } from './financeOverview.service/formatUtils';
import { isDateWithinFinanceRange, resolveFinanceDateRange } from './financeOverview.service/rangeUtils';

import type {
  CostCalculationRecord,
  FinanceDateRange,
  FinanceOverviewDrilldownKey,
  FinanceOverviewDrilldownPayload,
  FinanceExpenseRecord,
  FinanceIncomeRecord,
  FinanceOverviewMetrics,
} from '../types';

interface CalculateFinanceOverviewInput {
  beans: Bean[];
  calculations: CostCalculationRecord[];
  expenseRecords: FinanceExpenseRecord[];
  incomeRecords: FinanceIncomeRecord[];
  roastBatches: RoastBatchRecord[];
  range: FinanceDateRange;
  defaultTemplateId?: null | string;
  templates: CostTemplate[];
}

interface BuildFinanceOverviewDrilldownInput {
  beans: Bean[];
  calculations: CostCalculationRecord[];
  expenseRecords: FinanceExpenseRecord[];
  incomeRecords: FinanceIncomeRecord[];
  key: FinanceOverviewDrilldownKey;
  roastBatches: RoastBatchRecord[];
  range: FinanceDateRange;
  defaultTemplateId?: null | string;
  templates: CostTemplate[];
}

export { isDateWithinFinanceRange, resolveFinanceDateRange } from './financeOverview.service/rangeUtils';

export const getDateTextFromTimestamp = (value: string): string => {
  return getFinanceDateTextFromTimestamp(value);
};

export const calculateEstimatedRevenueFromBeans = (
  beans: Bean[],
  templates: CostTemplate[],
): number => {
  const templatesById = buildCostTemplateById(templates);

  return toMoney(
    beans.reduce((total, bean) => total + (calculateEstimatedBeanProfit(bean, templatesById)?.revenue ?? 0), 0),
  );
};

export const calculateFinanceOverview = ({
  beans,
  calculations,
  expenseRecords,
  incomeRecords,
  roastBatches,
  range,
  templates,
  defaultTemplateId,
}: CalculateFinanceOverviewInput): FinanceOverviewMetrics => {
  const templatesById = buildCostTemplateById(templates);
  const fallbackTemplate = defaultTemplateId ? templatesById.get(defaultTemplateId) : undefined;
  const shippingCostByBatchId = buildShippingCostByBatchId(expenseRecords, range);
  const roastBatchRevenueRecords = buildRoastBatchRevenueRecords(
    roastBatches,
    beans,
    range,
    templatesById,
    shippingCostByBatchId,
    calculations,
    fallbackTemplate,
  );
  const estimatedProfitMetrics = beans
    .map((bean) => calculateEstimatedBeanProfit(bean, templatesById))
    .filter((metrics): metrics is NonNullable<typeof metrics> => metrics !== null);
  const receivedIncomeRecords = incomeRecords.filter((record) => {
    return record.status === 'received' && isDateWithinFinanceRange(record.incomeDate, range);
  });
  const filteredExpenseRecords = expenseRecords.filter((record) => isDateWithinFinanceRange(record.expenseDate, range));
  const filteredBeanPurchases = beans.filter((bean) => {
    const purchaseDate = bean.purchaseDate ?? getFinanceDateTextFromTimestamp(bean.createdAt);
    const purchasedTotalPrice = bean.purchasedTotalPrice ?? 0;

    return purchasedTotalPrice > 0 && isDateWithinFinanceRange(purchaseDate, range);
  });

  const realizedIncome = toMoney(
    roastBatchRevenueRecords.reduce((total, record) => total + record.amount, 0) +
      receivedIncomeRecords.reduce((total, record) => total + record.amount, 0),
  );
  const beanPurchaseExpenses = toMoney(
    filteredBeanPurchases.reduce((total, bean) => {
      return total + (bean.purchasedTotalPrice ?? 0);
    }, 0),
  );
  const paidManualExpenses = filteredExpenseRecords.filter((record) => record.status === 'paid');
  const manualExpenses = toMoney(
    paidManualExpenses.reduce((total, record) => {
      return total + record.amount;
    }, 0),
  );
  const grossProfitExpenses = toMoney(
    paidManualExpenses.reduce((total, record) => {
      if (record.category !== 'packaging' && record.category !== 'shipping') {
        return total;
      }

      return total + record.amount;
    }, 0),
  );
  const totalExpenses = toMoney(beanPurchaseExpenses + manualExpenses);
  const grossProfit = toMoney(realizedIncome - beanPurchaseExpenses - grossProfitExpenses);
  const operatingProfit = toMoney(realizedIncome - totalExpenses);

  return {
    estimatedBeanCost: toMoney(estimatedProfitMetrics.reduce((total, metrics) => total + metrics.beanCost, 0)),
    estimatedProfit: toMoney(estimatedProfitMetrics.reduce((total, metrics) => total + metrics.profit, 0)),
    estimatedRevenue: toMoney(estimatedProfitMetrics.reduce((total, metrics) => total + metrics.revenue, 0)),
    expenseRecordCount: filteredExpenseRecords.length + filteredBeanPurchases.length,
    grossProfit,
    incomeRecordCount: roastBatchRevenueRecords.length + receivedIncomeRecords.length,
    operatingProfit,
    realizedIncome,
    realizedBeanCost: toMoney(roastBatchRevenueRecords.reduce((total, record) => total + record.beanCost, 0)),
    realizedProfit: toMoney(roastBatchRevenueRecords.reduce((total, record) => total + record.amount - record.beanCost - record.nonBeanCost - record.shippingCost, 0)),
    totalExpenses,
  };
};

export const buildFinanceOverviewDrilldown = ({
  beans,
  calculations,
  expenseRecords,
  incomeRecords,
  key,
  roastBatches,
  range,
  defaultTemplateId,
  templates,
}: BuildFinanceOverviewDrilldownInput): FinanceOverviewDrilldownPayload => {
  if (key === 'estimatedRevenue' || key === 'estimatedBeanCost' || key === 'estimatedProfit') {
    void calculations;
    return buildInventoryDrilldown(beans, templates, key);
  }

  if (key === 'realizedIncome' || key === 'realizedBeanCost' || key === 'realizedProfit') {
    return buildRealizedDrilldown(
      beans,
      calculations,
      expenseRecords,
      incomeRecords,
      key,
      roastBatches,
      range,
      templates,
      defaultTemplateId,
    );
  }

  return buildExpenseDrilldown(beans, expenseRecords, range);
};
