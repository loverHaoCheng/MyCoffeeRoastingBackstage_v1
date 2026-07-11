import { describe, expect, it } from 'vitest';

import { getSelectableRoastPlans, isGenericRoastPlan } from '@/modules/roast/utils/roastPlanSelection';
import type { RoastPlan } from '@/types/domain';

const createPlan = (overrides: Partial<RoastPlan>): RoastPlan => ({
  batchWeightGrams: 200,
  beanId: 'bean-1',
  beanName: '测试生豆',
  createdAt: '2026-07-11T00:00:00.000Z',
  id: 'plan-1',
  name: '测试计划',
  plannedBatchKg: 0.2,
  roastPurpose: '',
  status: 'draft',
  steps: [],
  targetRoastLevel: '浅烘',
  updatedAt: '2026-07-11T00:00:00.000Z',
  ...overrides,
});

describe('roastPlanSelection', () => {
  it('keeps generic plans selectable before a green bean is selected', () => {
    const genericPlan = createPlan({ beanId: 'generic', beanName: '通用', id: 'generic-plan' });
    const specificPlan = createPlan({ beanId: 'bean-1', id: 'specific-plan' });

    expect(getSelectableRoastPlans([genericPlan, specificPlan], '')).toEqual([genericPlan]);
  });

  it('includes generic and matching specific plans after selecting a green bean', () => {
    const genericPlan = createPlan({ beanId: 'generic', beanName: '通用', id: 'generic-plan' });
    const matchingPlan = createPlan({ beanId: 'bean-1', id: 'matching-plan' });
    const otherPlan = createPlan({ beanId: 'bean-2', id: 'other-plan' });

    expect(getSelectableRoastPlans([genericPlan, matchingPlan, otherPlan], 'bean-1')).toEqual([
      genericPlan,
      matchingPlan,
    ]);
  });

  it('recognizes legacy generic plans by their stored bean name', () => {
    expect(isGenericRoastPlan(createPlan({ beanId: '', beanName: '通用' }))).toBe(true);
  });
});
