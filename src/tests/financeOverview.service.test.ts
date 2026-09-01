import { describe, expect, it } from 'vitest';

import {
  buildHistoricalSaleSnapshotUpdate,
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
    expect(overview.estimatedRevenue).toBe(800);
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
      revenue: 160,
      saleUnitCount: 2,
    });
    // 成本模板事后被调整可能使历史批次“超容量”；此时仍按实际售出份数计算，
    // 不再返回 null 整锅剔除（否则财务总览会静默漏算已实现收入）。
    expect(calculateRoastBatchProfit(createBatch('batch-1', 3), bean, templatesById)).toMatchObject({
      beanCost: 72,
      profit: 138,
      revenue: 240,
      saleUnitCount: 3,
    });
  });

  it('uses sales snapshots after bean costs and templates change', () => {
    const batch: RoastBatchRecord = {
      ...createBatch('snapshot-batch', 2),
      beanCostPerSaleUnitSnapshot: 24,
      nonBeanCostPerSaleUnitSnapshot: 10,
      saleUnitPriceSnapshot: 80,
    };
    const changedBean: Bean = { ...bean, costPerKg: 300, defaultSaleUnitPrice: 120 };
    const changedTemplate: CostTemplate = {
      ...template,
      energyCost: 30,
      otherCost: 20,
      packagingCost: 50,
      roastInputWeightGrams: 500,
    };

    expect(calculateRoastBatchProfit(batch, changedBean, new Map([[changedTemplate.id, changedTemplate]]), 12))
      .toMatchObject({ beanCost: 48, nonBeanCost: 20, profit: 80, revenue: 160, shippingCost: 12 });
  });

  it('falls back to a saved cost calculation when the current bean is unavailable', () => {
    const calculation = {
      ...template,
      beanId: 'bean-1',
      beanName: bean.name,
      calculationName: '历史核算',
      costPerRoastedKg: 0,
      costPerSaleUnit: 0,
      createdAt: '2026-07-01T00:00:00.000Z',
      dataSource: 'greenBean' as const,
      greenBeanCost: 24,
      id: 'calculation-1',
      laborCost: 10,
      profitPerSaleUnit: 0,
      profitRate: 0,
      purchaseCostPerKg: 120,
      roastedOutputWeightGrams: 160,
      saleUnitCount: 2,
      saleUnitPrice: 80,
      saleUnitWeightGrams: 80,
      suggestedSalePrice: 0,
      targetProfitRate: 20,
      totalBatchCost: 44,
      updatedAt: '2026-07-08T00:00:00.000Z',
    };

    expect(calculateRoastBatchProfit(createBatch('calculation-batch', 2), undefined, new Map(), 0, calculation))
      .toMatchObject({ beanCost: 24, nonBeanCost: 10, profit: 126, revenue: 160 });
  });

  it('uses the default template for a historical sale whose bean has no template relation', () => {
    const beanWithoutTemplate: Bean = { ...bean, costTemplateId: null };

    expect(calculateRoastBatchProfit(
      createBatch('default-template-batch', 2),
      beanWithoutTemplate,
      new Map([[template.id, template]]),
      0,
      undefined,
      template,
    )).toMatchObject({ beanCost: 48, nonBeanCost: 20, profit: 92, revenue: 160 });
  });

  it('matches a historical sale to the current bean by name when IDs changed', () => {
    const historicalBatch = { ...createBatch('name-match-batch', 1), greenBeanId: 'old-bean-id' };
    const overview = calculateFinanceOverview({
      beans: [bean],
      calculations: [],
      defaultTemplateId: template.id,
      expenseRecords: [],
      incomeRecords: [],
      range,
      roastBatches: [historicalBatch],
      templates: [template],
    });

    expect(overview.realizedBeanCost).toBe(24);
  });

  it('creates one-time snapshots only for completed sale records', () => {
    const templatesById = new Map([[template.id, template]]);

    expect(buildHistoricalSaleSnapshotUpdate(createBatch('batch-1', 2), bean, templatesById)).toEqual({
      beanCostPerSaleUnitSnapshot: 24,
      nonBeanCostPerSaleUnitSnapshot: 10,
      saleUnitPriceSnapshot: 80,
    });
    expect(buildHistoricalSaleSnapshotUpdate({ ...createBatch('batch-2', 1), salesMode: 'selfUse' }, bean, templatesById))
      .toBeNull();
    expect(buildHistoricalSaleSnapshotUpdate({
      ...createBatch('batch-3', 1),
      beanCostPerSaleUnitSnapshot: 24,
      nonBeanCostPerSaleUnitSnapshot: 10,
      saleUnitPriceSnapshot: 80,
    }, bean, templatesById)).toBeNull();
  });

  it('repairs all-zero snapshots from historical calculation data first', () => {
    const allZeroBatch: RoastBatchRecord = {
      ...createBatch('all-zero-batch', 1),
      finalSaleUnitPrice: 36,
      saleUnitPriceSnapshot: 0,
      beanCostPerSaleUnitSnapshot: 0,
      nonBeanCostPerSaleUnitSnapshot: 0,
    };
    const calculation = {
      ...template,
      beanId: bean.id.toString(),
      beanName: bean.name,
      calculationName: '历史核算',
      costPerRoastedKg: 0,
      costPerSaleUnit: 0,
      createdAt: '2026-07-01T00:00:00.000Z',
      dataSource: 'greenBean' as const,
      greenBeanCost: 24,
      id: 'calculation-all-zero',
      laborCost: 10,
      profitPerSaleUnit: 0,
      profitRate: 0,
      purchaseCostPerKg: 120,
      roastedOutputWeightGrams: 160,
      saleUnitCount: 2,
      saleUnitPrice: 80,
      saleUnitWeightGrams: 80,
      suggestedSalePrice: 0,
      targetProfitRate: 20,
      totalBatchCost: 44,
      updatedAt: '2026-07-08T00:00:00.000Z',
    };

    expect(buildHistoricalSaleSnapshotUpdate(allZeroBatch, bean, new Map([[template.id, template]]), calculation))
      .toEqual({
        beanCostPerSaleUnitSnapshot: 12,
        nonBeanCostPerSaleUnitSnapshot: 5,
        saleUnitPriceSnapshot: 36,
      });
  });

  it('does not use all-zero snapshots as historical costs while backfill is pending', () => {
    const allZeroBatch: RoastBatchRecord = {
      ...createBatch('all-zero-calculation-batch', 2),
      finalSaleUnitPrice: 36,
      saleUnitPriceSnapshot: 0,
      beanCostPerSaleUnitSnapshot: 0,
      nonBeanCostPerSaleUnitSnapshot: 0,
    };
    const calculation = {
      ...template,
      beanId: bean.id.toString(),
      beanName: bean.name,
      calculationName: '历史核算',
      costPerRoastedKg: 0,
      costPerSaleUnit: 0,
      createdAt: '2026-07-01T00:00:00.000Z',
      dataSource: 'greenBean' as const,
      greenBeanCost: 24,
      id: 'calculation-all-zero-profit',
      laborCost: 10,
      profitPerSaleUnit: 0,
      profitRate: 0,
      purchaseCostPerKg: 120,
      roastedOutputWeightGrams: 160,
      saleUnitCount: 2,
      saleUnitPrice: 80,
      saleUnitWeightGrams: 80,
      suggestedSalePrice: 0,
      targetProfitRate: 20,
      totalBatchCost: 44,
      updatedAt: '2026-07-08T00:00:00.000Z',
    };

    expect(calculateRoastBatchProfit(allZeroBatch, bean, new Map([[template.id, template]]), 0, calculation))
      .toMatchObject({ beanCost: 24, nonBeanCost: 10, profit: 38, revenue: 72 });
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

    expect(overview.realizedIncome).toBe(240);
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
