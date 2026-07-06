import { describe, expect, it } from 'vitest';

import { getEffectiveRoastPlanStatus } from '@/modules/roast/constants/roastPlanStatus';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { RoastPlan } from '@/types/domain';

const createPlan = (status: RoastPlan['status'] = 'draft'): Pick<RoastPlan, 'id' | 'status'> => ({
  id: 'plan-1',
  status,
});

describe('getEffectiveRoastPlanStatus', () => {
  it('keeps the original status when no batch is linked', () => {
    expect(getEffectiveRoastPlanStatus(createPlan('draft'), [])).toBe('draft');
  });

  it('promotes a planned roast plan to completed when linked batches exist', () => {
    const batches: Pick<RoastBatchRecord, 'roastPlanId' | 'status'>[] = [
      {
        roastPlanId: 'plan-1',
        status: 'completed',
      },
    ];

    expect(getEffectiveRoastPlanStatus(createPlan('draft'), batches)).toBe('completed');
  });
});
