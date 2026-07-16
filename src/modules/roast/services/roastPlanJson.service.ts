import { AppError } from '@/shared/errors/AppError';
import type { RoastPlan } from '@/types/domain';

import { normalizeRoasterModel } from '../constants/roasterModel';
import { roastPlanJsonSchema } from '../schemas/roastPlanJson.schema';
import type { RoastPlanJsonInput, RoastPlanJsonStep } from '../types';

export const sampleRoastPlanJson = JSON.stringify(
  {
    name: '新建烘焙计划',
    beanName: '待选择生豆',
    beanId: 'sample-bean-id',
    roasterModel: 'tank200d',
    batchWeightGrams: 200,
    roastLevel: '中焙',
    purpose: '手冲',
    steps: [
      {
        time: '0:00',
        event: '入豆',
        operation: '入豆',
        temperature: '200°C',
        airTemperature: '185°C',
        firePower: '80%',
        drumSpeed: '45rpm',
      },
      {
        time: '1:30',
        event: '回温点',
        operation: '保持',
        temperature: '-',
        airTemperature: '160°C',
        firePower: '80%',
        drumSpeed: '45rpm',
      },
      {
        time: '4:30',
        event: '转黄',
        operation: '降火',
        temperature: '150°C',
        airTemperature: '145°C',
        firePower: '70%',
        drumSpeed: '48rpm',
      },
      {
        time: '8:30',
        event: '一爆开始',
        operation: '保持',
        temperature: '198°C',
        airTemperature: '188°C',
        firePower: '60%',
        drumSpeed: '50rpm',
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
    roasterModel: normalizeRoasterModel(plan.roasterModel),
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
      airTemperature: step.airTemperature,
      firePower: step.firePower,
      drumSpeed: step.drumSpeed,
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

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const readNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number(value.trim());

  return Number.isFinite(parsed) ? parsed : undefined;
};

const readBeanId = (value: unknown): RoastPlanJsonInput['beanId'] | undefined => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return undefined;
};

const mergeStepDraft = (fallback: RoastPlanJsonStep, value: unknown): RoastPlanJsonStep => {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    time: readString(value.time) ?? fallback.time,
    event: readString(value.event) ?? fallback.event,
    operation: readString(value.operation) ?? fallback.operation,
    temperature: readString(value.temperature) ?? fallback.temperature,
    airTemperature: readString(value.airTemperature) ?? fallback.airTemperature,
    firePower: readString(value.firePower) ?? fallback.firePower,
    drumSpeed: readString(value.drumSpeed) ?? fallback.drumSpeed,
    note: readString(value.note) ?? fallback.note,
  };
};

const emptyStepDraft: RoastPlanJsonStep = {
  time: '',
  event: '',
  operation: '',
  temperature: '',
  airTemperature: '',
  firePower: '',
  drumSpeed: '',
};

export function parseRoastPlanJsonDraft(jsonText: string, fallback: RoastPlanJsonInput): RoastPlanJsonInput {
  let payload: unknown;

  try {
    payload = JSON.parse(jsonText) as unknown;
  } catch (error) {
    throw new AppError('JSON 格式不正确，请检查逗号、引号和括号。', {
      code: 'BUSINESS',
      cause: error,
    });
  }

  if (!isRecord(payload)) {
    throw new AppError('JSON 内容必须是一个对象。', {
      code: 'BUSINESS',
    });
  }

  const fallbackSteps = fallback.steps.length > 0 ? fallback.steps : [emptyStepDraft];
  const inputSteps = Array.isArray(payload.steps) ? payload.steps : [];
  const steps =
    inputSteps.length > 0
      ? inputSteps.map((step, index) => {
          const fallbackStep = fallbackSteps[index] ?? fallbackSteps[0] ?? emptyStepDraft;

          return mergeStepDraft(fallbackStep, step);
        })
      : fallback.steps;
  const beanId = readBeanId(payload.beanId);

  return {
    ...fallback,
    name: readString(payload.name) ?? fallback.name,
    beanName: readString(payload.beanName) ?? fallback.beanName,
    ...(beanId == null ? {} : { beanId }),
    roasterModel: readString(payload.roasterModel) ?? fallback.roasterModel,
    batchWeightGrams: readNumber(payload.batchWeightGrams) ?? fallback.batchWeightGrams,
    roastLevel: readString(payload.roastLevel) ?? fallback.roastLevel,
    purpose: readString(payload.purpose) ?? fallback.purpose,
    steps,
  };
}

export function roastPlanToJsonInput(plan: RoastPlan): RoastPlanJsonInput {
  return {
    name: plan.name,
    beanId: plan.beanId,
    beanName: plan.beanName,
    roasterModel: normalizeRoasterModel(plan.roasterModel),
    batchWeightGrams: plan.batchWeightGrams,
    roastLevel: plan.targetRoastLevel,
    purpose: plan.roastPurpose,
    steps: plan.steps.map((step) => ({
      time: step.timeLabel,
      event: step.eventName,
      operation: step.operation,
      temperature: step.drumTemperature,
      airTemperature: step.airTemperature,
      firePower: step.firePower,
      drumSpeed: step.drumSpeed,
      note: step.note,
    })),
  };
}

export function updateRoastPlanFromInput(plan: RoastPlan, input: RoastPlanJsonInput): RoastPlan {
  const nextPlan = createRoastPlan(input, typeof plan.id === 'number' ? plan.id : 0);

  return {
    ...nextPlan,
    id: plan.id,
    createdAt: plan.createdAt,
    status: plan.status,
  };
}
