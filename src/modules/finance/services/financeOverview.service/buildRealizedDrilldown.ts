import type { Bean } from '@/types/domain';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import type { CostCalculationRecord, FinanceDateRange, FinanceExpenseRecord, FinanceIncomeRecord, FinanceOverviewDetailItem, FinanceOverviewDrilldownPayload, RoastBatchRevenueDetail } from '../../types';
import { buildCostTemplateById } from '../financeProfitCalculation.service';
import { buildRoastBatchRevenueRecords } from './buildRoastBatchRevenueRecords';
import { buildShippingCostByBatchId } from './buildShippingCostByBatchId';
import { getFinanceDateTextFromTimestamp } from './dateUtils';
import { formatRevenueUnitCount, toMoney } from './formatUtils';
import { isDateWithinFinanceRange } from './rangeUtils';
import { sortOverviewDetailRecords } from './sortUtils';
import { getFinanceIncomeChannelLabel } from '../../utils/incomePresentation';

export const buildRealizedDrilldown = (
  beans: Bean[],
  calculations: CostCalculationRecord[],
  expenseRecords: FinanceExpenseRecord[],
  incomeRecords: FinanceIncomeRecord[],
  key: 'realizedBeanCost' | 'realizedIncome' | 'realizedProfit',
  roastBatches: RoastBatchRecord[],
  range: FinanceDateRange,
  templates: CostTemplate[],
  defaultTemplateId?: null | string,
): FinanceOverviewDrilldownPayload => {
  const roastBatchRevenueRecords = buildRoastBatchRevenueRecords(
    roastBatches,
    beans,
    range,
    buildCostTemplateById(templates),
    buildShippingCostByBatchId(expenseRecords, range),
    calculations,
    defaultTemplateId ? buildCostTemplateById(templates).get(defaultTemplateId) : undefined,
  );
  const manualIncomeRecords: FinanceOverviewDetailItem[] = key === 'realizedIncome' ? incomeRecords
    .filter((record) => record.status === 'received' && isDateWithinFinanceRange(record.incomeDate, range))
    .map((record) => ({
      amount: toMoney(record.amount),
      categoryLabel: getFinanceIncomeChannelLabel(record.channel),
      date: record.incomeDate,
      deletable: true,
      id: record.id,
      notes: record.notes ?? null,
      sourceEntityId: record.sourceEntityId ?? null,
      sourceType: 'manualIncome',
      sourceLabel: '手工补录收入',
      title: record.title,
    })) : [];
  const realizedDrilldownConfig = {
    realizedBeanCost: {
      getAmount: (record: RoastBatchRevenueDetail) => record.beanCost,
      title: '已售出生豆成本明细',
    },
    realizedIncome: {
      getAmount: (record: RoastBatchRevenueDetail) => record.amount,
      title: '已实现收入明细',
    },
    realizedProfit: {
      getAmount: (record: RoastBatchRevenueDetail) => record.amount - record.beanCost - record.nonBeanCost - record.shippingCost,
      title: '已实现利润明细',
    },
  } as const;
  const config = realizedDrilldownConfig[key];
  const records = sortOverviewDetailRecords(
    [
      ...roastBatchRevenueRecords.map((record) => ({
        amount: toMoney(config.getAmount(record)),
        categoryLabel: `${formatRevenueUnitCount(record.saleUnitCount)} 份 × ¥${record.saleUnitPrice.toFixed(2)} · 销售收入 ¥${record.amount.toFixed(2)} · 生豆成本 ¥${record.beanCost.toFixed(2)} · 模板成本 ¥${record.nonBeanCost.toFixed(2)} · 邮费 ¥${record.shippingCost.toFixed(2)} · 利润 ¥${(record.amount - record.beanCost - record.nonBeanCost - record.shippingCost).toFixed(2)}`,
        date: record.date,
        deleteHint: '烘焙历史收入请前往烘焙历史中修改对应记录。',
        deletable: false,
        id: record.id,
        notes: record.notes,
        sourceType: 'roastBatchRevenue' as const,
        sourceLabel: '烘焙历史销售',
        title: record.title,
      })),
      ...manualIncomeRecords,
    ],
  );

  return {
    emptyText: '当前时间范围内还没有可展示的销售烘焙记录',
    key,
    records,
    title: config.title,
    total: toMoney(records.reduce((sum, record) => sum + record.amount, 0)),
  };
};
