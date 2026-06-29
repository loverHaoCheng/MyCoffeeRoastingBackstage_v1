import { supabaseConnectionSettingsService } from '@/modules/settings/services/supabaseConnectionSettings.service';
import { AppError } from '@/shared/errors/AppError';
import type { ApiResponse } from '@/services/api.types';
import { SupabaseRestClient } from '@/services/supabaseRestClient';
import type { RoastPlan } from '@/types/domain';

import { createRoastPlan, createRoastPlanFromJson, updateRoastPlanFromInput } from './roastPlanJson.service';
import type { RoastPlanJsonInput } from '../types';

interface RoastPlanRepository {
  createPlan: (input: RoastPlanJsonInput) => Promise<ApiResponse<RoastPlan>>;
  createPlanFromJson: (jsonText: string) => Promise<ApiResponse<RoastPlan>>;
  deletePlan: (planId: RoastPlan['id']) => Promise<ApiResponse<null>>;
  listPlans: () => Promise<ApiResponse<RoastPlan[]>>;
  updatePlan: (planId: RoastPlan['id'], input: RoastPlanJsonInput) => Promise<ApiResponse<RoastPlan>>;
}

interface SupabaseRoastPlanOverviewRecord {
  batch_weight_grams: number;
  bean_name: string;
  created_at: string;
  green_bean_id: string;
  id: string;
  name: string;
  planned_batch_kg: number;
  roast_purpose: null | string;
  status: string;
  steps: unknown;
  target_roast_level: null | string;
  updated_at: string;
}

interface SupabaseRoastProfileMutationRecord {
  id: string;
}

interface SupabaseGreenBeanLookupRecord {
  id: string;
}

interface SupabaseRoastPlanStepRecord {
  event?: string;
  firePower?: string;
  note?: string;
  operation?: string;
  temperature?: string;
  time?: string;
}

type RoastPlanStatus = RoastPlan['status'];

const ROAST_PLAN_STATUS_SET = new Set<RoastPlanStatus>(['draft', 'inProgress', 'completed', 'cancelled']);

let localRoastPlans: RoastPlan[] = [];

const ok = <T,>(data: T): ApiResponse<T> => ({
  code: 0,
  data,
  message: 'ok',
});

const sortPlans = (plans: RoastPlan[]): RoastPlan[] => {
  return [...plans].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
};

const normalizeRoastPlanStatus = (status: null | string | undefined): RoastPlanStatus => {
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
    const record = (typeof step === 'object' && step != null ? step : {}) as SupabaseRoastPlanStepRecord;

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

const mapSupabaseRoastPlanRecord = (record: SupabaseRoastPlanOverviewRecord): RoastPlan => ({
  id: record.id,
  name: record.name,
  beanId: record.green_bean_id,
  beanName: record.bean_name,
  batchWeightGrams: record.batch_weight_grams,
  plannedBatchKg: record.planned_batch_kg,
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

const resolveGreenBeanId = async (client: SupabaseRestClient, input: RoastPlanJsonInput): Promise<string> => {
  if (typeof input.beanId === 'string' && isUuidLike(input.beanId)) {
    return input.beanId;
  }

  if (input.beanName.trim().length > 0) {
    const records = await client.list<SupabaseGreenBeanLookupRecord>('green_beans', {
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

const toSupabaseRoastPlanPayload = async (
  client: SupabaseRestClient,
  input: RoastPlanJsonInput,
  status: RoastPlanStatus = 'draft',
): Promise<Record<string, unknown>> => {
  return {
    batch_weight_grams: input.batchWeightGrams,
    green_bean_id: await resolveGreenBeanId(client, input),
    is_active: true,
    name: input.name,
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

const hasSupabaseConnection = (): boolean => {
  const connection = supabaseConnectionSettingsService.resolveProjectConnection('greenBean');

  return connection.projectUrl.trim().length > 0 && connection.publishableKey.trim().length > 0;
};

const getSupabaseClient = (): SupabaseRestClient => {
  const connection = supabaseConnectionSettingsService.resolveProjectConnection('greenBean');

  return new SupabaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });
};

const getRoastPlanById = async (
  client: SupabaseRestClient,
  planId: RoastPlan['id'],
): Promise<RoastPlan> => {
  const records = await client.list<SupabaseRoastPlanOverviewRecord>('roast_plan_overview', {
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

  return mapSupabaseRoastPlanRecord(record);
};

class LocalRoastPlanRepository implements RoastPlanRepository {
  async createPlan(input: RoastPlanJsonInput): Promise<ApiResponse<RoastPlan>> {
    const nextId = Math.max(0, ...localRoastPlans.map((plan) => (typeof plan.id === 'number' ? plan.id : 0))) + 1;
    const plan = createRoastPlan(input, nextId);

    localRoastPlans = sortPlans([plan, ...localRoastPlans]);

    return ok(plan);
  }

  async createPlanFromJson(jsonText: string): Promise<ApiResponse<RoastPlan>> {
    const nextId = Math.max(0, ...localRoastPlans.map((plan) => (typeof plan.id === 'number' ? plan.id : 0))) + 1;
    const plan = createRoastPlanFromJson(jsonText, nextId);

    localRoastPlans = sortPlans([plan, ...localRoastPlans]);

    return ok(plan);
  }

  async deletePlan(planId: RoastPlan['id']): Promise<ApiResponse<null>> {
    localRoastPlans = localRoastPlans.filter((plan) => String(plan.id) !== String(planId));

    return ok(null);
  }

  async listPlans(): Promise<ApiResponse<RoastPlan[]>> {
    return ok(sortPlans(localRoastPlans));
  }

  async updatePlan(planId: RoastPlan['id'], input: RoastPlanJsonInput): Promise<ApiResponse<RoastPlan>> {
    const currentPlan = localRoastPlans.find((plan) => String(plan.id) === String(planId));

    if (!currentPlan) {
      throw new AppError('烘焙计划不存在', {
        code: 'BUSINESS',
      });
    }

    const nextPlan = updateRoastPlanFromInput(currentPlan, input);

    localRoastPlans = sortPlans(
      localRoastPlans.map((plan) => (String(plan.id) === String(planId) ? nextPlan : plan)),
    );

    return ok(nextPlan);
  }
}

class SupabaseRoastPlanRepository implements RoastPlanRepository {
  constructor(private readonly client: SupabaseRestClient) {}

  async createPlan(input: RoastPlanJsonInput): Promise<ApiResponse<RoastPlan>> {
    const insertedRows = await this.client.insert<Record<string, unknown>, SupabaseRoastProfileMutationRecord>(
      'roast_profiles',
      await toSupabaseRoastPlanPayload(this.client, input),
      {
        select: 'id',
      },
    );

    const insertedRecord = insertedRows[0];

    if (!insertedRecord) {
      throw new AppError('烘焙计划创建成功，但未返回新记录。', {
        code: 'DATA',
      });
    }

    return ok(await getRoastPlanById(this.client, insertedRecord.id));
  }

  async createPlanFromJson(jsonText: string): Promise<ApiResponse<RoastPlan>> {
    const draftPlan = createRoastPlanFromJson(jsonText, 0);

    return this.createPlan({
      batchWeightGrams: draftPlan.batchWeightGrams,
      beanId: draftPlan.beanId,
      beanName: draftPlan.beanName,
      name: draftPlan.name,
      purpose: draftPlan.roastPurpose,
      roastLevel: draftPlan.targetRoastLevel,
      steps: draftPlan.steps.map((step) => ({
        event: step.eventName,
        firePower: step.firePower,
        note: step.note,
        operation: step.operation,
        temperature: step.drumTemperature,
        time: step.timeLabel,
      })),
    });
  }

  async deletePlan(planId: RoastPlan['id']): Promise<ApiResponse<null>> {
    await this.client.delete('roast_profiles', {
      match: {
        id: String(planId),
      },
    });

    return ok(null);
  }

  async listPlans(): Promise<ApiResponse<RoastPlan[]>> {
    const records = await this.client.list<SupabaseRoastPlanOverviewRecord>('roast_plan_overview', {
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return ok(records.map(mapSupabaseRoastPlanRecord));
  }

  async updatePlan(planId: RoastPlan['id'], input: RoastPlanJsonInput): Promise<ApiResponse<RoastPlan>> {
    const currentPlan = await getRoastPlanById(this.client, planId);

    const updatedRows = await this.client.update<Record<string, unknown>, SupabaseRoastProfileMutationRecord>(
      'roast_profiles',
      await toSupabaseRoastPlanPayload(this.client, input, currentPlan.status),
      {
        match: {
          id: String(planId),
        },
        select: 'id',
      },
    );

    const updatedRecord = updatedRows[0];

    if (!updatedRecord) {
      throw new AppError('烘焙计划更新成功，但未返回结果。', {
        code: 'DATA',
      });
    }

    return ok(await getRoastPlanById(this.client, updatedRecord.id));
  }
}

const resolveRoastPlanRepository = (): RoastPlanRepository => {
  if (import.meta.env.MODE === 'test') {
    return new LocalRoastPlanRepository();
  }

  if (!hasSupabaseConnection()) {
    return new LocalRoastPlanRepository();
  }

  return new SupabaseRoastPlanRepository(getSupabaseClient());
};

export const roastPlanService = {
  async createPlan(input: RoastPlanJsonInput): Promise<ApiResponse<RoastPlan>> {
    return resolveRoastPlanRepository().createPlan(input);
  },
  async createPlanFromJson(jsonText: string): Promise<ApiResponse<RoastPlan>> {
    return resolveRoastPlanRepository().createPlanFromJson(jsonText);
  },
  async deletePlan(planId: RoastPlan['id']): Promise<ApiResponse<null>> {
    return resolveRoastPlanRepository().deletePlan(planId);
  },
  async listPlans(): Promise<ApiResponse<RoastPlan[]>> {
    return resolveRoastPlanRepository().listPlans();
  },
  async updatePlan(planId: RoastPlan['id'], input: RoastPlanJsonInput): Promise<ApiResponse<RoastPlan>> {
    return resolveRoastPlanRepository().updatePlan(planId, input);
  },
  hasSupabaseConnection,
};
