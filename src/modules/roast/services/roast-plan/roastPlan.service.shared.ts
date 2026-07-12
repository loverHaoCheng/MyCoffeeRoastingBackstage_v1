import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { isPocketBaseProjectConnectionConfigured } from '@/modules/settings/types';
import { AppError } from '@/shared/errors/AppError';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';
import type { ApiResponse } from '@/services/api.types';
import type { RoastPlan } from '@/types/domain';

import type { RoastPlanJsonInput } from '../../types';
import {
  GENERIC_BEAN_ID,
  GENERIC_BEAN_NAME,
  ROAST_PLAN_STATUS_SET,
  type RoastPlanStatus,
} from './roastPlan.service.state';
import type {
  RemoteGreenBeanLookupRecord,
  RemoteRoastPlanOverviewRecord,
  RemoteRoastPlanStepRecord,
} from './roastPlan.service.types';

export const ok = <T,>(data: T): ApiResponse<T> => ({
  code: 0,
  data,
  message: 'ok',
});

export const normalizeRoastPlanStatus = (status: null | string | undefined): RoastPlanStatus => {
  if (!status || !ROAST_PLAN_STATUS_SET.has(status as RoastPlanStatus)) {
    return 'draft';
  }

  return status as RoastPlanStatus;
};

const mapRoastPlanSteps = (steps: unknown): RoastPlan['steps'] => {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps.map((step, index) => {
    const record = (typeof step === 'object' && step != null ? step : {}) as RemoteRoastPlanStepRecord;

    return {
      id: index + 1,
      timeLabel: record.time ?? '',
      eventName: record.event ?? '',
      operation: record.operation ?? '',
      drumTemperature: record.temperature ?? '-',
      firePower: record.firePower ?? '',
      note: record.note,
    };
  });
};

export const mapRemoteRoastPlanRecord = (record: RemoteRoastPlanOverviewRecord): RoastPlan => ({
  id: record.id,
  name: record.name,
  beanId: record.green_bean_id ?? GENERIC_BEAN_ID,
  beanName: record.bean_name ?? GENERIC_BEAN_NAME,
  batchWeightGrams: record.batch_weight_grams,
  plannedBatchKg: toPlannedBatchKilograms(record.batch_weight_grams),
  targetRoastLevel: record.target_roast_level ?? '',
  roastPurpose: record.roast_purpose ?? '',
  status: normalizeRoastPlanStatus(record.status),
  steps: mapRoastPlanSteps(record.steps),
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

const isUuidLike = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

export const toPlannedBatchKilograms = (batchWeightGrams: number): number => {
  return Number((batchWeightGrams / 1000).toFixed(3));
};

const toPocketBaseCompatiblePlannedBatchKilograms = (batchWeightGrams: number): number => {
  return Math.max(1, toPlannedBatchKilograms(batchWeightGrams));
};

const resolveGreenBeanId = async (client: PocketBaseRestClient, input: RoastPlanJsonInput): Promise<null | string> => {
  if (String(input.beanId ?? '') === GENERIC_BEAN_ID || input.beanName.trim() === GENERIC_BEAN_NAME) {
    return null;
  }

  if (typeof input.beanId === 'string' && isUuidLike(input.beanId)) {
    return input.beanId;
  }

  if (input.beanName.trim().length > 0) {
    const records = await client.list<RemoteGreenBeanLookupRecord>('green_beans', {
      limit: 1,
      match: {
        display_name: input.beanName.trim(),
      },
      select: 'id',
    });

    const record = records[0];

    if (record) {
      return record.id;
    }
  }

  throw new AppError('未找到对应的生豆，请先同步生豆数据或在界面里重新选择生豆。', {
    code: 'BUSINESS',
  });
};

export const toRemoteRoastPlanPayload = async (
  client: PocketBaseRestClient,
  input: RoastPlanJsonInput,
  status: RoastPlanStatus = 'draft',
): Promise<Record<string, unknown>> => {
  return {
    batch_weight_grams: input.batchWeightGrams,
    bean_name: input.beanName.trim(),
    green_bean_id: await resolveGreenBeanId(client, input),
    is_active: true,
    name: input.name,
    planned_batch_kg: toPocketBaseCompatiblePlannedBatchKilograms(input.batchWeightGrams),
    roast_purpose: input.purpose ?? null,
    status,
    steps: input.steps.map((step) => ({
      event: step.event,
      firePower: step.firePower,
      note: step.note,
      operation: step.operation,
      temperature: step.temperature,
      time: step.time,
    })),
    target_roast_level: input.roastLevel,
  };
};

export const hasGreenBeanConnection = (): boolean => {
  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');

  return isPocketBaseProjectConnectionConfigured(connection);
};

export const getGreenBeanClient = (): PocketBaseRestClient => {
  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');

  return new PocketBaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });
};

export const getRoastPlanById = async (
  client: PocketBaseRestClient,
  planId: RoastPlan['id'],
): Promise<RoastPlan> => {
  const records = await client.list<RemoteRoastPlanOverviewRecord>('roast_plan_overview', {
    limit: 1,
    match: {
      id: String(planId),
    },
  });

  const record = records[0];

  if (!record) {
    throw new AppError('未找到对应的烘焙计划。', {
      code: 'DATA',
    });
  }

  return mapRemoteRoastPlanRecord(record);
};
