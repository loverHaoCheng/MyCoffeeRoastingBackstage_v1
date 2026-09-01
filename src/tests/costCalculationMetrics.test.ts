import { describe, expect, it } from 'vitest';

import { calculateCostMetrics } from '@/modules/finance/services';
import { AppError } from '@/shared/errors/AppError';

const createInput = (overrides = {}) => ({
  beanId: 'bean-1',
  beanName: '测试生豆',
  calculationName: '测试成本',
  dehydrationRate: 14,
  energyCost: 0,
  laborCost: 10,
  notes: '',
  otherCost: 0,
  packagingCost: 0,
  purchaseCostPerKg: 100,
  roastInputWeightGrams: 500,
  saleUnitPrice: 0,
  saleUnitWeightGrams: 200,
  targetProfitRate: 30,
  ...overrides,
});

describe('calculateCostMetrics', () => {
  it('uses complete sale units to allocate cost and calculates the suggested price by gross margin', () => {
    const metrics = calculateCostMetrics(createInput());

    expect(metrics.roastedOutputWeightGrams).toBe(430);
    expect(metrics.saleUnitCount).toBe(2);
    expect(metrics.totalBatchCost).toBe(60);
    expect(metrics.costPerSaleUnit).toBe(30);
    expect(metrics.suggestedSalePrice).toBe(42.86);
    expect(metrics.profitRate).toBe(30);
  });

  it('rejects a template that cannot form one complete sale unit', () => {
    expect(() => calculateCostMetrics(createInput({ saleUnitWeightGrams: 500 }))).toThrowError(
      new AppError('无法形成完整销售份数，请调整模板参数。', { code: 'BUSINESS' }),
    );
  });

  it('rejects a gross margin of 100% or more', () => {
    expect(() => calculateCostMetrics(createInput({ targetProfitRate: 100 }))).toThrowError(
      new AppError('毛利率必须小于 100%。', { code: 'BUSINESS' }),
    );
  });
});
