import { describe, expect, it } from 'vitest';

import {
  toPocketBaseRoastBatchCreatePayload,
  toPocketBaseRoastBatchPayload,
} from '@/modules/roast/services/roastBatch.service';

describe('roastBatch PocketBase payload mapping', () => {
  it('includes required create fields and default status', () => {
    const payload = toPocketBaseRoastBatchCreatePayload({
      greenBeanId: 'bean-1',
      greenBeanName: '耶加雪菲 G1',
      inputWeightGrams: 200,
      outputWeightGrams: 172,
      roastDate: '2026-07-07T10:00:00.000Z',
      roastLevel: '中焙',
    });

    expect(payload.green_bean_id).toBe('bean-1');
    expect(payload.green_bean_name).toBe('耶加雪菲 G1');
    expect(payload.status).toBe('completed');
  });

  it('maps optional display names to PocketBase field names', () => {
    const payload = toPocketBaseRoastBatchPayload({
      greenBeanName: '花魁',
      roastPlanId: 'plan-1',
      roastPlanName: '测试计划',
      roastedBeanName: '花魁 SOE',
      status: 'draft',
    });

    expect(payload.green_bean_name).toBe('花魁');
    expect(payload.roast_plan_id).toBe('plan-1');
    expect(payload.roast_plan_name).toBe('测试计划');
    expect(payload.roasted_bean_name).toBe('花魁 SOE');
    expect(payload.status).toBe('draft');
  });
});
