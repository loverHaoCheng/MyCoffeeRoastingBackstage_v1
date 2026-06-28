import { AppError } from '@/shared/errors/AppError';
import type { RoastPlan } from '@/types/domain';

import { roastPlanJsonSchema } from '../schemas/roastPlanJson.schema';
import type { RoastPlanJsonInput } from '../types';

export const sampleRoastPlanJson = JSON.stringify(
  {
    name: '肯尼亚 柏拉 AA Plus SL28 SL34 水洗',
    beanName: '肯尼亚 柏拉 AA Plus SL28 SL34 水洗',
    beanId: 101,
    batchWeightGrams: 200,
    roastLevel: '手冲浅烘',
    purpose: '手冲',
    steps: [
      {
        time: '0:00',
        event: '入豆',
        operation: '入豆',
        temperature: '235°C',
        firePower: '90%',
      },
      {
        time: '1:20~1:30',
        event: '回温点',
        operation: '保持',
        temperature: '-',
        firePower: '90%',
      },
      {
        time: '2:00',
        event: '前段降火',
        operation: '降火',
        temperature: '-',
        firePower: '85%',
      },
      {
        time: '4:40~5:00',
        event: '转黄',
        operation: '降火',
        temperature: '154~158°C（参考）',
        firePower: '75%',
      },
      {
        time: '8:50~9:20',
        event: '一爆开始',
        operation: '保持',
        temperature: '208±2°C',
        firePower: '65%',
      },
    ],
  },
  null,
  2,
);

export function createRoastPlan(input: unknown, id: number): RoastPlan {
  const parsed = roastPlanJsonSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues.map((issue) => issue.message).join('；'), {
      code: 'BUSINESS',
      cause: parsed.error,
    });
  }

  const now = new Date().toISOString();
  const plan = parsed.data;

  return {
    id,
    name: plan.name,
    beanId: plan.beanId ?? id,
    beanName: plan.beanName,
    batchWeightGrams: plan.batchWeightGrams,
    plannedBatchKg: Number((plan.batchWeightGrams / 1000).toFixed(3)),
    targetRoastLevel: plan.roastLevel,
    roastPurpose: plan.purpose ?? '未设置',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    steps: plan.steps.map((step, index) => ({
      id: index + 1,
      timeLabel: step.time,
      eventName: step.event,
      operation: step.operation,
      drumTemperature: step.temperature,
      firePower: step.firePower,
      note: step.note,
    })),
  };
}

export function createRoastPlanFromJson(jsonText: string, id: number): RoastPlan {
  let payload: unknown;

  try {
    payload = JSON.parse(jsonText) as unknown;
  } catch (error) {
    throw new AppError('JSON 格式不正确，请检查逗号、引号和括号。', {
      code: 'BUSINESS',
      cause: error,
    });
  }

  return createRoastPlan(payload, id);
}

export function roastPlanToJsonInput(plan: RoastPlan): RoastPlanJsonInput {
  return {
    name: plan.name,
    beanId: plan.beanId,
    beanName: '',
    batchWeightGrams: plan.batchWeightGrams,
    roastLevel: plan.targetRoastLevel,
    purpose: plan.roastPurpose,
    steps: plan.steps.map((step) => ({
      time: step.timeLabel,
      event: step.eventName,
      operation: step.operation,
      temperature: step.drumTemperature,
      firePower: step.firePower,
      note: step.note,
    })),
  };
}

export function updateRoastPlanFromInput(plan: RoastPlan, input: RoastPlanJsonInput): RoastPlan {
  const nextPlan = createRoastPlan(input, plan.id);

  return {
    ...nextPlan,
    createdAt: plan.createdAt,
    status: plan.status,
  };
}
