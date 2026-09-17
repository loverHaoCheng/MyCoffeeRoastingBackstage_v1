import type { Bean } from '@/types/domain';
import type { FinanceDateRange, FinanceExpenseRecord, FinanceOverviewDetailItem, FinanceOverviewDrilldownPayload } from '../../types';
import { getFinanceExpenseCategoryLabel } from '../../utils/expensePresentation';
import { getFinanceDateTextFromTimestamp } from './dateUtils';
import { toMoney } from './formatUtils';
import { isDateWithinFinanceRange } from './rangeUtils';
import { sortOverviewDetailRecords } from './sortUtils';

export const buildExpenseDrilldown = (
  beans: Bean[],
  expenseRecords: FinanceExpenseRecord[],
  range: FinanceDateRange,
): FinanceOverviewDrilldownPayload => {
  const beanPurchaseRecords: FinanceOverviewDetailItem[] = beans
    .filter((bean) => {
      const purchaseDate = bean.purchaseDate ?? getFinanceDateTextFromTimestamp(bean.createdAt);
      const purchasedTotalPrice = bean.purchasedTotalPrice ?? 0;

      return purchasedTotalPrice > 0 && isDateWithinFinanceRange(purchaseDate, range);
    })
    .map((bean) => ({
      amount: toMoney(bean.purchasedTotalPrice ?? 0),
      categoryLabel: '生豆采购',
      date: bean.purchaseDate ?? getFinanceDateTextFromTimestamp(bean.createdAt),
      deleteHint: '自动计入记录请到生豆库存中修改或删除采购数据。',
      deletable: false,
      id: `bean-${String(bean.id)}`,
      notes: bean.notes ?? null,
      sourceEntityId: String(bean.id),
      sourceType: 'autoBeanPurchase',
      sourceLabel: '生豆录入自动计入',
      title: bean.name,
    }));

  const manualExpenseRecords: FinanceOverviewDetailItem[] = expenseRecords
    .filter((record) => record.status === 'paid' && isDateWithinFinanceRange(record.expenseDate, range))
    .map((record) => ({
      amount: toMoney(record.amount),
      categoryLabel: getFinanceExpenseCategoryLabel(record.category, record.customCategoryLabel),
      date: record.expenseDate,
      deletable: true,
      id: record.id,
      notes: record.notes ?? null,
      sourceEntityId: record.sourceEntityId ?? null,
      sourceType: 'manualExpense',
      sourceLabel: '手工支出',
      title: record.title,
    }));

  const records = sortOverviewDetailRecords([...beanPurchaseRecords, ...manualExpenseRecords]);

  return {
    emptyText: '当前时间范围内还没有已支出记录',
    key: 'totalExpenses',
    records,
    title: '全部花费明细',
    total: toMoney(records.reduce((sum, record) => sum + record.amount, 0)),
  };
};
