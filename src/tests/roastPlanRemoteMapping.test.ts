import { describe, expect, it } from 'vitest';

import { mapRemoteRoastPlanRecord } from '@/modules/roast/services/roast-plan/roastPlan.service.shared';

describe('mapRemoteRoastPlanRecord', () => {
  it('maps PocketBase empty bean relations to the generic bean option', () => {
    const plan = mapRemoteRoastPlanRecord({
      batch_weight_grams: 200,
      bean_name: '通用',
      created_at: '2026-07-22T00:00:00.000Z',
      green_bean_id: '',
      id: 'plan-1',
      name: '通用计划',
      planned_batch_kg: 1,
      roaster_machine_id: 'machine-1',
      expand: { roaster_machine_id: { display_name: '店内 Tank200D' } },
      roast_purpose: '手冲',
      status: 'draft',
      steps: [],
      target_roast_level: '手冲浅烘',
      updated_at: '2026-07-22T00:00:00.000Z',
    });

    expect(plan.beanId).toBe('generic');
    expect(plan.beanName).toBe('通用');
  });
});
