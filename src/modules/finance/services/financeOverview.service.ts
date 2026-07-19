import type { Bean } from '@/types/domain';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import { toShanghaiDateString } from '@/shared/time/shanghaiTime';
import {
  buildCostTemplateById,
  calculateEstimatedBeanProfit,
  calculateRoastBatchProfit,
} from './financeProfitCalculation.service';

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
  templates: CostTemplate[];
}

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

const buildRoastBatchRevenueRecords = (
  roastBatches: RoastBatchRecord[],
  beans: Bean[],
  range: FinanceDateRange,
  templatesById: Map<string, CostTemplate>,
  shippingCostByBatchId: Map<string, number>,
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
      const shippingCost = shippingCostByBatchId.get(batch.id) ?? 0;
      const metrics = calculateRoastBatchProfit(batch, bean, templatesById, shippingCost);
      const saleUnitPrice = bean?.defaultSaleUnitPrice ?? 0;
      const saleUnitCount = batch.soldUnitCount ?? 1;
      const amount = metrics?.revenue ?? 0;
      const roastedBeanName = batch.roastedBeanName?.trim();

      return {
        amount,
        beanCost: metrics?.beanCost ?? 0,
        date: roastDate,
        id: batch.id,
        notes: batch.notes ?? null,
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

const buildShippingCostByBatchId = (
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
}: CalculateFinanceOverviewInput): FinanceOverviewMetrics => {
  void calculations;
  const templatesById = buildCostTemplateById(templates);
  const shippingCostByBatchId = buildShippingCostByBatchId(expenseRecords, range);
  const roastBatchRevenueRecords = buildRoastBatchRevenueRecords(
    roastBatches,
    beans,
    range,
    templatesById,
    shippingCostByBatchId,
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
    realizedProfit: toMoney(roastBatchRevenueRecords.reduce((total, record) => total + record.amount - record.beanCost - record.shippingCost, 0)),
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
  templates,
}: BuildFinanceOverviewDrilldownInput): FinanceOverviewDrilldownPayload => {
  if (key === 'estimatedRevenue' || key === 'estimatedBeanCost' || key === 'estimatedProfit') {
    void calculations;
    const templatesById = buildCostTemplateById(templates);
    const inventoryDrilldownConfig = {
      estimatedBeanCost: {
        getAmount: (metrics: NonNullable<ReturnType<typeof calculateEstimatedBeanProfit>>) => metrics.beanCost,
        title: '库存预估成本明细',
      },
      estimatedProfit: {
        getAmount: (metrics: NonNullable<ReturnType<typeof calculateEstimatedBeanProfit>>) => metrics.profit,
        title: '库存预估利润明细',
      },
      estimatedRevenue: {
        getAmount: (metrics: NonNullable<ReturnType<typeof calculateEstimatedBeanProfit>>) => metrics.revenue,
        title: '当前库存预估收入明细',
      },
    } as const;
    const config = inventoryDrilldownConfig[key];
    const records = sortOverviewDetailRecords(
      beans
        .map((bean) => {
          const metrics = calculateEstimatedBeanProfit(bean, templatesById);

          if (!metrics) {
            return null;
          }

          return {
            amount: config.getAmount(metrics),
            categoryLabel: `${formatRevenueUnitCount(metrics.saleUnitCount)} 份 · 可烘焙 ${String(metrics.plannedBatchCount)} 锅 · 成本 ¥${metrics.beanCost.toFixed(2)} · 利润 ¥${metrics.profit.toFixed(2)}`,
            date: getFinanceDateTextFromTimestamp(bean.updatedAt),
            deletable: false,
            id: `estimated-${String(bean.id)}`,
            notes: '按关联成本模板的生豆重量、脱水率和出售单份熟豆重量估算',
            sourceEntityId: String(bean.id),
            sourceType: 'estimatedRevenue' as const,
            sourceLabel: '当前库存估算',
            title: bean.name,
          };
        })
        .filter((record): record is NonNullable<typeof record> => record !== null && record.amount > 0),
    );

    return {
      emptyText: '当前还没有可用于估算的库存',
      key,
      records,
      title: config.title,
      total: toMoney(records.reduce((sum, record) => sum + record.amount, 0)),
    };
  }

  if (key === 'realizedIncome' || key === 'realizedBeanCost' || key === 'realizedProfit') {
    const roastBatchRevenueRecords = buildRoastBatchRevenueRecords(
      roastBatches,
      beans,
      range,
      buildCostTemplateById(templates),
      buildShippingCostByBatchId(expenseRecords, range),
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
        getAmount: (record: RoastBatchRevenueDetail) => record.amount - record.beanCost - record.shippingCost,
        title: '已实现利润明细',
      },
    } as const;
    const config = realizedDrilldownConfig[key];
    const records = sortOverviewDetailRecords(
      [
        ...roastBatchRevenueRecords.map((record) => ({
          amount: toMoney(config.getAmount(record)),
          categoryLabel: `${formatRevenueUnitCount(record.saleUnitCount)} 份 × ¥${record.saleUnitPrice.toFixed(2)} · 已售出生豆成本 ¥${record.beanCost.toFixed(2)} · 邮费 ¥${record.shippingCost.toFixed(2)} · 利润 ¥${(record.amount - record.beanCost - record.shippingCost).toFixed(2)}`,
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
