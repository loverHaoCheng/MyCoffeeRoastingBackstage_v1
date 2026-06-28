import { describe, expect, it } from 'vitest';

import { createRoastPlanFromJson, sampleRoastPlanJson } from '@/modules/roast/services';
import { AppError } from '@/shared/errors/AppError';

describe('createRoastPlanFromJson', () => {
  it('creates a typed roast plan from valid JSON', () => {
    const plan = createRoastPlanFromJson(sampleRoastPlanJson, 12);

    expect(plan.id).toBe(12);
    expect(plan.name).toContain('肯尼亚');
    expect(plan.batchWeightGrams).toBe(200);
    expect(plan.steps[0]?.eventName).toBe('入豆');
  });

  it('rejects invalid JSON content', () => {
    expect(() => createRoastPlanFromJson('{ bad json', 13)).toThrow(AppError);
  });
});

