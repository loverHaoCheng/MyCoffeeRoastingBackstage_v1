import { describe, expect, it } from 'vitest';

import {
  buildReservedShippingUnitCountByBatchId,
  buildFinanceOverviewDrilldown,
  calculateFinanceOverview,
  calculateRoastBatchProfit,
  calculateRoastSaleCapacity,
  resolveFinanceDateRange,
} from '@/modules/finance/services';
import type { FinanceExpenseRecord } from '@/modules/finance/types';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import type { Bean } from '@/types/domain';

const template: CostTemplate = {
  createdAt: '2026-07-01T00:00:00.000Z',
  dehydrationRate: 20,
  energyCost: 3,
  id: 'template-1',
  laborCost: 4,
  name: '200g 标准包装',
  notes: '',
  otherCost: 2,
  packagingCost: 5,
  roastInputWeightGrams: 200,
  saleUnitWeightGrams: 80,
  targetProfitRate: 20,
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const bean: Bean = {
  costPerKg: 120,
  costTemplateId: 'template-1',
  createdAt: '2026-07-01T00:00:00.000Z',
  defaultRoastInputGrams: 200,
  defaultSaleUnitPrice: 80,
  defaultSaleUnitWeightGrams: 80,
  grade: 'G1',
  id: 'bean-1',
  name: '耶加雪菲',
  origin: '埃塞俄比亚',
  process: '水洗',
  remainingWeightGrams: 1000,
  stockKg: 1,
  updatedAt: '2026-07-08T00:00:00.000Z',
};

const createBatch = (id: string, soldUnitCount: number): RoastBatchRecord => ({
  createdAt: '2026-07-08T09:00:00.000Z',
  evaluation: { allowTraining: false },
  greenBeanId: 'bean-1',
  greenBeanName: '耶加雪菲',
  id,
  inputWeightGrams: 200,
  outputWeightGrams: 160,
  roastDate: '2026-07-08T09:00:00.000Z',
  roastLevel: '中焙',
  salesMode: 'sale',
  soldUnitCount,
  status: 'completed',
  updatedAt: '2026-07-08T09:00:00.000Z',
});

const range = { endDate: '2026-07-31', startDate: '2026-07-01' };

describe('finance profit calculations', () => {
  it('calculates inventory from remaining green bean weight and its required template', () => {
    const overview = calculateFinanceOverview({
      beans: [bean], calculations: [], expenseRecords: [], incomeRecords: [], roastBatches: [], range, templates: [template],
    });

    // 1000g / 200g = 5 batches; each batch produces floor(160g / 80g) = 2 units.
    expect(overview.estimatedRevenue).toBe(700);
    expect(overview.estimatedBeanCost).toBe(240);
    expect(overview.estimatedProfit).toBe(460);
  });

  it('limits a roast batch to its planned sale-unit capacity', () => {
    const templatesById = new Map([[template.id, template]]);

    expect(calculateRoastSaleCapacity(200, template)).toMatchObject({
      maximumSoldUnitCount: 2,
      roastedWeightGrams: 160,
    });
    expect(calculateRoastBatchProfit(createBatch('batch-1', 2), bean, templatesById)).toMatchObject({
      beanCost: 48,
      profit: 92,
      revenue: 140,
      saleUnitCount: 2,
    });
    expect(calculateRoastBatchProfit(createBatch('batch-1', 3), bean, templatesById)).toBeNull();
  });

  it('allocates related paid shipping by the number of associated sale units', () => {
    const shipping: FinanceExpenseRecord = {
      amount: 20,
      category: 'shipping',
      createdAt: '2026-07-08T09:00:00.000Z',
      customCategoryLabel: null,
      expenseDate: '2026-07-08',
      id: 'shipping-1',
      notes: null,
      roastBatchIds: ['batch-1', 'batch-1', 'batch-2'],
      status: 'paid',
      title: '邮费',
      updatedAt: '2026-07-08T09:00:00.000Z',
    };
    const overview = calculateFinanceOverview({
      beans: [bean], calculations: [], expenseRecords: [shipping], incomeRecords: [],
      roastBatches: [createBatch('batch-1', 2), createBatch('batch-2', 1)], range, templates: [template],
    });
    const drilldown = buildFinanceOverviewDrilldown({
      beans: [bean], calculations: [], expenseRecords: [shipping], incomeRecords: [],
      key: 'realizedIncome', roastBatches: [createBatch('batch-1', 2), createBatch('batch-2', 1)], range, templates: [template],
    });

    expect(overview.realizedIncome).toBe(210);
    expect(overview.realizedBeanCost).toBe(72);
    expect(overview.realizedProfit).toBe(118);
    const recordById = new Map(drilldown.records.map((record) => [record.id, record]));

    expect(recordById.get('batch-1')?.categoryLabel).toContain('邮费 ¥13.33');
    expect(recordById.get('batch-2')?.categoryLabel).toContain('邮费 ¥6.67');
  });

  it('builds separate detail totals for every realized and inventory overview metric', () => {
    const shipping: FinanceExpenseRecord = {
      amount: 20,
      category: 'shipping',
      createdAt: '2026-07-08T09:00:00.000Z',
      customCategoryLabel: null,
      expenseDate: '2026-07-08',
      id: 'shipping-1',
      notes: null,
      roastBatchIds: ['batch-1', 'batch-1', 'batch-2'],
      status: 'paid',
      title: '邮费',
      updatedAt: '2026-07-08T09:00:00.000Z',
    };
    const input = {
      beans: [bean], calculations: [], expenseRecords: [shipping], incomeRecords: [],
      roastBatches: [createBatch('batch-1', 2), createBatch('batch-2', 1)], range, templates: [template],
    };

    expect(buildFinanceOverviewDrilldown({ ...input, key: 'estimatedBeanCost' })).toMatchObject({
      title: '库存预估成本明细', total: 240,
    });
    expect(buildFinanceOverviewDrilldown({ ...input, key: 'estimatedProfit' })).toMatchObject({
      title: '库存预估利润明细', total: 460,
    });
    expect(buildFinanceOverviewDrilldown({ ...input, key: 'realizedBeanCost' })).toMatchObject({
      title: '已售出生豆成本明细', total: 72,
    });
    expect(buildFinanceOverviewDrilldown({ ...input, key: 'realizedProfit' })).toMatchObject({
      title: '已实现利润明细', total: 118,
    });
  });

  it('reserves sale units associated with every saved shipping expense', () => {
    const reservedUnitCountByBatchId = buildReservedShippingUnitCountByBatchId([
      {
        amount: 12,
        category: 'shipping',
        createdAt: '2026-07-08T09:00:00.000Z',
        customCategoryLabel: null,
        expenseDate: '2026-07-08',
        id: 'shipping-paid',
        notes: null,
        roastBatchIds: ['batch-1', 'batch-1'],
        status: 'paid',
        title: '邮费',
        updatedAt: '2026-07-08T09:00:00.000Z',
      },
      {
        amount: 8,
        category: 'shipping',
        createdAt: '2026-07-09T09:00:00.000Z',
        customCategoryLabel: null,
        expenseDate: '2026-07-09',
        id: 'shipping-pending',
        notes: null,
        roastBatchIds: ['batch-1', 'batch-2'],
        status: 'pending',
        title: '待付邮费',
        updatedAt: '2026-07-09T09:00:00.000Z',
      },
    ]);

    expect(reservedUnitCountByBatchId.get('batch-1')).toBe(3);
    expect(reservedUnitCountByBatchId.get('batch-2')).toBe(1);
  });

  it('resolves finance date ranges from the Shanghai calendar day', () => {
    expect(resolveFinanceDateRange('today', null, new Date('2026-07-13T16:30:00.000Z'))).toEqual({
      endDate: '2026-07-14', startDate: '2026-07-14',
    });
  });
});
