import { describe, expect, it } from 'vitest';

import { createRoastPlanFromJson, parseRoastPlanJsonDraft, sampleRoastPlanJson } from '@/modules/roast/services';
import { AppError } from '@/shared/errors/AppError';
import type { RoastPlanJsonInput } from '@/modules/roast/types';

const fallbackDraft: RoastPlanJsonInput = {
  name: '',
  beanName: '',
  roasterModel: '',
  batchWeightGrams: 200,
  roastLevel: '手冲浅烘',
  purpose: '手冲',
  steps: [
    {
      time: '0:00',
      event: '入豆',
      operation: '入豆',
      temperature: '235°C',
      airTemperature: '210°C',
      firePower: '90%',
      drumSpeed: '45rpm',
    },
  ],
};

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

  it('keeps an associated roaster name from JSON import', () => {
    const plan = createRoastPlanFromJson(JSON.stringify({
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
    }), 14);

    expect(plan.roasterModel).toBe('HiBean Arc');
  });

  it('parses incomplete JSON into a form draft without requiring final plan fields', () => {
    const draft = parseRoastPlanJsonDraft(JSON.stringify({
      name: 'JSON 草稿',
      steps: [
        {
          time: '1:30',
          event: '回温点',
        },
      ],
    }), fallbackDraft);

    expect(draft.name).toBe('JSON 草稿');
    expect(draft.roasterModel).toBe('');
    expect(draft.batchWeightGrams).toBe(200);
    expect(draft.roastLevel).toBe('手冲浅烘');
    expect(draft.steps[0]).toMatchObject({
      time: '1:30',
      event: '回温点',
      operation: '入豆',
      temperature: '235°C',
    });
  });
});
