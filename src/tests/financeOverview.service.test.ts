import { describe, expect, it } from 'vitest';

import { calculateFinanceOverview } from '@/modules/finance/services';
import type { CostCalculationRecord, FinanceExpenseRecord } from '@/modules/finance/types';
import type { Bean } from '@/types/domain';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';

describe('calculateFinanceOverview', () => {
  it('aggregates total expenses, realized income, gross profit and operating profit with bean purchases included', () => {
    const beans: Bean[] = [
      {
        costPerKg: 120,
        createdAt: '2026-07-01T00:00:00.000Z',
        defaultSaleUnitPrice: 80,
        defaultSaleUnitWeightGrams: 100,
        grade: 'G1',
        id: 'bean-1',
        name: '耶加雪菲',
        origin: '埃塞俄比亚',
        process: '水洗',
        purchaseDate: '2026-07-03',
        purchasedTotalPrice: 180,
        stockKg: 2,
        updatedAt: '2026-07-08T00:00:00.000Z',
      },
    ];

    const calculations: CostCalculationRecord[] = [
      {
        beanId: 'bean-1',
        beanName: '耶加雪菲',
        calculationName: '耶加雪菲 100g',
        costPerRoastedKg: 700,
        costPerSaleUnit: 70,
        createdAt: '2026-07-08T09:00:00.000Z',
        dataSource: 'greenBean',
        dehydrationRate: 20,
        energyCost: 10,
        greenBeanCost: 90,
        id: 'calc-1',
        laborCost: 8,
        notes: undefined,
        otherCost: 2,
        packagingCost: 10,
        profitPerSaleUnit: 10,
        profitRate: 12.5,
        purchaseCostPerKg: 450,
        roastInputWeightGrams: 200,
        roastedOutputWeightGrams: 160,
        saleUnitCount: 1.6,
        saleUnitPrice: 80,
        saleUnitWeightGrams: 100,
        suggestedSalePrice: 80,
        targetProfitRate: 20,
        totalBatchCost: 120,
        updatedAt: '2026-07-08T09:00:00.000Z',
      },
    ];

    const roastBatches: RoastBatchRecord[] = [
      {
        createdAt: '2026-07-08T09:00:00.000Z',
        developmentRatio: 12,
        firstCrackTime: 380,
        finalSaleUnitPrice: 92,
        greenBeanId: 'bean-1',
        greenBeanName: '耶加雪菲',
        id: 'batch-1',
        imageUrls: [],
        inputWeightGrams: 200,
        notes: undefined,
        outputWeightGrams: 160,
        roastDate: '2026-07-08T09:00:00.000Z',
        roastLevel: '中焙',
        roastPlanId: undefined,
        roastPlanName: undefined,
        roastedBeanName: '耶加雪菲 熟豆',
        salesMode: 'sale',
        status: 'completed',
        totalRoastTime: 520,
        updatedAt: '2026-07-08T09:00:00.000Z',
      },
    ];

    const expenseRecords: FinanceExpenseRecord[] = [
      {
        amount: 40,
        category: 'packaging',
        createdAt: '2026-07-08T09:00:00.000Z',
        customCategoryLabel: null,
        expenseDate: '2026-07-08',
        id: 'expense-1',
        notes: null,
        status: 'paid',
        title: '包装支出',
        updatedAt: '2026-07-08T09:00:00.000Z',
      },
      {
        amount: 10,
        category: 'other',
        createdAt: '2026-07-09T09:00:00.000Z',
        customCategoryLabel: null,
        expenseDate: '2026-07-09',
        id: 'expense-2',
        notes: null,
        status: 'pending',
        title: '待付杂项',
        updatedAt: '2026-07-09T09:00:00.000Z',
      },
      {
        amount: 20,
        category: 'custom',
        createdAt: '2026-07-10T09:00:00.000Z',
        customCategoryLabel: '耗材',
        expenseDate: '2026-07-10',
        id: 'expense-3',
        notes: null,
        status: 'paid',
        title: '耗材',
        updatedAt: '2026-07-10T09:00:00.000Z',
      },
    ];

    const overview = calculateFinanceOverview({
      beans,
      calculations,
      expenseRecords,
      roastBatches,
      range: {
        endDate: '2026-07-31',
        startDate: '2026-07-01',
      },
    });

    expect(overview.realizedIncome).toBe(92);
    expect(overview.totalExpenses).toBe(240);
    expect(overview.grossProfit).toBe(-128);
    expect(overview.operatingProfit).toBe(-148);
    expect(overview.estimatedRevenue).toBe(1280);
    expect(overview.expenseRecordCount).toBe(4);
    expect(overview.incomeRecordCount).toBe(1);
  });
});
