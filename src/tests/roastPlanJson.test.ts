import { describe, expect, it } from 'vitest';

import { createRoastPlanFromJson, sampleRoastPlanJson } from '@/modules/roast/services';
import { AppError } from '@/shared/errors/AppError';

describe('createRoastPlanFromJson', () => {
  it('creates a typed roast plan from valid JSON', () => {
    const plan = createRoastPlanFromJson(sampleRoastPlanJson, 12);

    expect(plan.id).toBe(12);
    expect(plan.name).toBe('新建烘焙计划');
    expect(plan.beanId).toBe('sample-bean-id');
    expect(plan.roasterModel).toBe('tank200d');
    expect(plan.batchWeightGrams).toBe(200);
    expect(plan.steps[0]?.eventName).toBe('入豆');
    expect(plan.steps[0]?.airTemperature).toBe('185°C');
    expect(plan.steps[0]?.drumSpeed).toBe('45rpm');
  });

  it('rejects invalid JSON content', () => {
    expect(() => createRoastPlanFromJson('{ bad json', 13)).toThrow(AppError);
  });

  it('rejects unsupported roaster model values from JSON import', () => {
    expect(() => createRoastPlanFromJson(JSON.stringify({
      name: '旧计划',
      beanName: '测试豆',
      beanId: 'bean-1',
      roasterModel: 'HiBean Arc',
      batchWeightGrams: 200,
      roastLevel: '手冲浅烘',
      purpose: '手冲',
      steps: [
        {
          time: '0:00',
          event: '入豆',
          operation: '入豆',
          temperature: '200°C',
          airTemperature: '180°C',
          firePower: '80%',
          drumSpeed: '45rpm',
        },
      ],
    }), 14)).toThrow(AppError);
  });
});
