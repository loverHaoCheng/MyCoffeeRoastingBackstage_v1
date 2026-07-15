import { describe, expect, it } from 'vitest';

import { syncDeletedBeanBatches, syncDeletedBeanPlans, detachDeletedPlanFromBatches } from '@/modules/roast/utils/roastCacheSync';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { RoastPlan } from '@/types/domain';

describe('roast cache sync', () => {
  it('clears deleted roast plan references from roast batches immediately', () => {
    const batches: RoastBatchRecord[] = [
      {
        createdAt: '2026-07-13T10:00:00.000Z',
        evaluation: {
          allowTraining: false,
        },
        greenBeanId: 'bean-1',
        greenBeanName: '测试豆',
        id: 'batch-1',
        inputWeightGrams: 200,
        outputWeightGrams: 170,
        roastDate: '2026-07-13T10:00:00.000Z',
        roastLevel: '浅烘',
        roastPlanId: 'plan-1',
        roastPlanName: '计划一',
        salesMode: 'sale',
        status: 'completed',
        updatedAt: '2026-07-13T10:00:00.000Z',
      },
    ];

    const result = detachDeletedPlanFromBatches(batches, 'plan-1');

    expect(result[0]).toMatchObject({
      roastPlanId: undefined,
      roastPlanName: undefined,
    });
  });

  it('removes deleted bean roast batches and syncs related roast plans immediately', () => {
    const plans: RoastPlan[] = [
      {
        batchWeightGrams: 200,
        beanId: 'bean-1',
        beanName: '测试豆',
        createdAt: '2026-07-13T10:00:00.000Z',
        id: 'plan-1',
        name: '计划一',
        plannedBatchKg: 2,
        roasterModel: 'tank200d',
        roastPurpose: '手冲',
        status: 'draft',
        steps: [],
        targetRoastLevel: '浅烘',
        updatedAt: '2026-07-13T10:00:00.000Z',
      },
    ];
    const batches: RoastBatchRecord[] = [
      {
        createdAt: '2026-07-13T10:00:00.000Z',
        evaluation: {
          allowTraining: false,
        },
        greenBeanId: 'bean-1',
        greenBeanName: '测试豆',
        id: 'batch-1',
        inputWeightGrams: 200,
        outputWeightGrams: 170,
        roastDate: '2026-07-13T10:00:00.000Z',
        roastLevel: '浅烘',
        salesMode: 'sale',
        status: 'completed',
        updatedAt: '2026-07-13T10:00:00.000Z',
      },
    ];

    expect(syncDeletedBeanBatches(batches, 'bean-1')).toEqual([]);
    expect(syncDeletedBeanPlans(plans, 'bean-1', 'delete')).toEqual([]);
    expect(syncDeletedBeanPlans(plans, 'bean-1', 'makeGeneric')[0]).toMatchObject({
      beanId: 'generic',
      beanName: '通用',
    });
  });
});
