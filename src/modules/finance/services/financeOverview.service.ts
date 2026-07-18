import type { Bean } from '@/types/domain';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import { toShanghaiDateString } from '@/shared/time/shanghaiTime';

import type {
  CostCalculationRecord,
  FinanceDateRange,
  FinanceOverviewDetailItem,
  FinanceOverviewDrilldownKey,
  FinanceOverviewDrilldownPayload,
  FinanceExpenseRecord,
  FinanceIncomeRecord,
  FinanceOverviewMetrics,
  FinanceRangePreset,
  RoastBatchRevenueDetail,
} from '../types';
import { getFinanceExpenseCategoryLabel } from '../utils/expensePresentation';
import { getFinanceIncomeChannelLabel } from '../utils/incomePresentation';

interface CalculateFinanceOverviewInput {
  beans: Bean[];
  calculations: CostCalculationRecord[];
  expenseRecords: FinanceExpenseRecord[];
  incomeRecords: FinanceIncomeRecord[];
  roastBatches: RoastBatchRecord[];
  range: FinanceDateRange;
}

interface BuildFinanceOverviewDrilldownInput {
  beans: Bean[];
  calculations: CostCalculationRecord[];
  expenseRecords: FinanceExpenseRecord[];
  incomeRecords: FinanceIncomeRecord[];
  key: FinanceOverviewDrilldownKey;
  roastBatches: RoastBatchRecord[];
  range: FinanceDateRange;
}

const DEFAULT_DEHYDRATION_RATE = 14;

const createDateTextFromUtcDate = (value: Date): string => {
  return value.toISOString().slice(0, 10);
};

const createUtcDateFromDateText = (dateText: string): Date => {
  const [year = '1970', month = '01', day = '01'] = dateText.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
};

const shiftDateText = (dateText: string, offsetDays: number): string => {
  const nextValue = createUtcDateFromDateText(dateText);

  nextValue.setUTCDate(nextValue.getUTCDate() + offsetDays);

  return createDateTextFromUtcDate(nextValue);
};

const getDayOfWeekFromDateText = (dateText: string): number => {
  return createUtcDateFromDateText(dateText).getUTCDay();
};

const getYearFromDateText = (dateText: string): string => {
  return dateText.slice(0, 4);
};

const getYearMonthFromDateText = (dateText: string): string => {
  return dateText.slice(0, 7);
};

const getFinanceDateTextFromTimestamp = (value: string): string => {
  return toShanghaiDateString(value) || value.slice(0, 10);
};

const clampRate = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
};

const toMoney = (value: number): number => {
  return Number(value.toFixed(2));
};

const formatRevenueUnitCount = (value: number): string => {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const sortOverviewDetailRecords = (records: FinanceOverviewDetailItem[]): FinanceOverviewDetailItem[] => {
  return [...records].sort((left, right) => {
    if (left.date === right.date) {
      return right.id.localeCompare(left.id);
    }

    return right.date.localeCompare(left.date);
  });
};

const buildBeanMap = (beans: Bean[]): Map<string, Bean> => {
  return new Map(beans.map((bean) => [String(bean.id), bean]));
};

const buildLatestCalculationByBeanId = (calculations: CostCalculationRecord[]): Map<string, CostCalculationRecord> => {
  const latestCalculationByBeanId = new Map<string, CostCalculationRecord>();

  calculations.forEach((record) => {
    const beanKey = record.beanId;
    const currentLatestRecord = latestCalculationByBeanId.get(beanKey);

    if (!currentLatestRecord) {
      latestCalculationByBeanId.set(beanKey, record);
      return;
    }

    if (new Date(record.updatedAt).getTime() > new Date(currentLatestRecord.updatedAt).getTime()) {
      latestCalculationByBeanId.set(beanKey, record);
    }
  });

  return latestCalculationByBeanId;
};

const buildRoastBatchRevenueRecords = (
  roastBatches: RoastBatchRecord[],
  beans: Bean[],
  range: FinanceDateRange,
): RoastBatchRevenueDetail[] => {
  const beanMap = buildBeanMap(beans);

  return roastBatches
    .filter((batch) => {
      const roastDate = getFinanceDateTextFromTimestamp(batch.roastDate);

      return batch.status === 'completed' && batch.salesMode === 'sale' && isDateWithinFinanceRange(roastDate, range);
    })
    .map((batch) => {
      const roastDate = getFinanceDateTextFromTimestamp(batch.roastDate);
      const bean = beanMap.get(batch.greenBeanId);
      const saleUnitPrice = batch.finalSaleUnitPrice ?? bean?.defaultSaleUnitPrice ?? 0;
      const saleUnitCount = 1;
      const amount = saleUnitPrice > 0 ? toMoney(saleUnitPrice) : 0;
      const roastedBeanName = batch.roastedBeanName?.trim();

      return {
        amount,
        date: roastDate,
        id: batch.id,
        notes: batch.notes ?? null,
        saleUnitCount,
        saleUnitPrice,
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

export const isDateWithinFinanceRange = (dateText: string, range: FinanceDateRange): boolean => {
  return dateText >= range.startDate && dateText <= range.endDate;
};

export const getDateTextFromTimestamp = (value: string): string => {
  return getFinanceDateTextFromTimestamp(value);
};

export const resolveFinanceDateRange = (
  preset: FinanceRangePreset,
  customRange: FinanceDateRange | null,
  now = new Date(),
): FinanceDateRange => {
  const today = toShanghaiDateString(now) || createDateTextFromUtcDate(now);

  if (preset === 'custom' && customRange) {
    return customRange;
  }

  if (preset === 'all') {
    return {
      endDate: today,
      startDate: '1900-01-01',
    };
  }

  if (preset === 'today') {
    return {
      endDate: today,
      startDate: today,
    };
  }

  if (preset === 'week') {
    const dayOfWeek = getDayOfWeekFromDateText(today);
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    return {
      endDate: today,
      startDate: shiftDateText(today, mondayOffset),
    };
  }

  if (preset === 'year') {
    return {
      endDate: today,
      startDate: `${getYearFromDateText(today)}-01-01`,
    };
  }

  return {
    endDate: today,
    startDate: `${getYearMonthFromDateText(today)}-01`,
  };
};

export const calculateEstimatedRevenueFromBeans = (
  beans: Bean[],
  calculations: CostCalculationRecord[],
): number => {
  const latestCalculationByBeanId = buildLatestCalculationByBeanId(calculations);

  return toMoney(
    beans.reduce((total, bean) => {
      if (bean.stockKg <= 0 || !bean.defaultSaleUnitPrice || !bean.defaultSaleUnitWeightGrams) {
        return total;
      }

      const latestCalculation = latestCalculationByBeanId.get(String(bean.id));
      const dehydrationRate = clampRate(latestCalculation?.dehydrationRate ?? DEFAULT_DEHYDRATION_RATE);
      const roastedOutputWeightGrams = bean.stockKg * 1000 * (1 - dehydrationRate / 100);
      const estimatedUnitCount = roastedOutputWeightGrams / bean.defaultSaleUnitWeightGrams;

      return total + estimatedUnitCount * bean.defaultSaleUnitPrice;
    }, 0),
  );
};

export const calculateFinanceOverview = ({
  beans,
  calculations,
  expenseRecords,
  incomeRecords,
  roastBatches,
  range,
}: CalculateFinanceOverviewInput): FinanceOverviewMetrics => {
  const roastBatchRevenueRecords = buildRoastBatchRevenueRecords(roastBatches, beans, range);
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
    estimatedRevenue: calculateEstimatedRevenueFromBeans(beans, calculations),
    expenseRecordCount: filteredExpenseRecords.length + filteredBeanPurchases.length,
    grossProfit,
    incomeRecordCount: roastBatchRevenueRecords.length + receivedIncomeRecords.length,
    operatingProfit,
    realizedIncome,
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
}: BuildFinanceOverviewDrilldownInput): FinanceOverviewDrilldownPayload => {
  if (key === 'estimatedRevenue') {
    const latestCalculationByBeanId = buildLatestCalculationByBeanId(calculations);
    const records = sortOverviewDetailRecords(
      beans
        .filter((bean) => bean.stockKg > 0 && (bean.defaultSaleUnitPrice ?? 0) > 0 && (bean.defaultSaleUnitWeightGrams ?? 0) > 0)
        .map((bean) => {
          const latestCalculation = latestCalculationByBeanId.get(String(bean.id));
          const dehydrationRate = clampRate(latestCalculation?.dehydrationRate ?? DEFAULT_DEHYDRATION_RATE);
          const roastedOutputWeightGrams = bean.stockKg * 1000 * (1 - dehydrationRate / 100);
          const estimatedUnitCount = roastedOutputWeightGrams / (bean.defaultSaleUnitWeightGrams ?? 1);
          const amount = toMoney(estimatedUnitCount * (bean.defaultSaleUnitPrice ?? 0));

          return {
            amount,
            categoryLabel: `${formatRevenueUnitCount(estimatedUnitCount)} 份 × ¥${(bean.defaultSaleUnitPrice ?? 0).toFixed(2)}`,
            date: getFinanceDateTextFromTimestamp(bean.updatedAt),
            deletable: false,
            id: `estimated-${String(bean.id)}`,
            notes: `剩余 ${bean.stockKg.toFixed(2)}kg · 按脱水率 ${dehydrationRate.toFixed(1)}% 估算`,
            sourceEntityId: String(bean.id),
            sourceType: 'estimatedRevenue' as const,
            sourceLabel: '当前库存估算',
            title: bean.name,
          };
        })
        .filter((record) => record.amount > 0),
    );

    return {
      emptyText: '当前还没有可用于估算收入的库存',
      key,
      records,
      title: '当前库存预估收入明细',
      total: toMoney(records.reduce((sum, record) => sum + record.amount, 0)),
    };
  }

  if (key === 'realizedIncome') {
    const roastBatchRevenueRecords = buildRoastBatchRevenueRecords(roastBatches, beans, range);
    const manualIncomeRecords: FinanceOverviewDetailItem[] = incomeRecords
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
      }));
    const records = sortOverviewDetailRecords(
      [
        ...roastBatchRevenueRecords.map((record) => ({
          amount: record.amount,
          categoryLabel: `${formatRevenueUnitCount(record.saleUnitCount)} 份 × ¥${record.saleUnitPrice.toFixed(2)}`,
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
      emptyText: '当前时间范围内还没有销售烘焙记录收入',
      key,
      records,
      title: '已实现收入明细',
      total: toMoney(records.reduce((sum, record) => sum + record.amount, 0)),
    };
  }

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
    key,
    records,
    title: '全部花费明细',
    total: toMoney(records.reduce((sum, record) => sum + record.amount, 0)),
  };
};
