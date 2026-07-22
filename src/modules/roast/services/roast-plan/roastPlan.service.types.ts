import type { ApiResponse } from '@/services/api.types';
import type { RoastPlan } from '@/types/domain';

import type { RoastPlanJsonInput } from '../../types';

export interface RoastPlanRepository {
  createPlan: (input: RoastPlanJsonInput) => Promise<ApiResponse<RoastPlan>>;
  createPlanFromJson: (jsonText: string) => Promise<ApiResponse<RoastPlan>>;
  deletePlan: (planId: RoastPlan['id']) => Promise<ApiResponse<null>>;
  listPlans: () => Promise<ApiResponse<RoastPlan[]>>;
  updatePlan: (planId: RoastPlan['id'], input: RoastPlanJsonInput) => Promise<ApiResponse<RoastPlan>>;
}

export interface RemoteRoastPlanOverviewRecord {
  batch_weight_grams: number;
  bean_name: null | string;
  created_at: string;
  green_bean_id: null | string;
  id: string;
  name: string;
  planned_batch_kg: number;
  roaster_machine_id: null | string;
  expand?: {
    roaster_machine_id?: {
      display_name?: string;
    };
  };
  roast_purpose: null | string;
  status: string;
  steps: unknown;
  target_roast_level: null | string;
  updated_at: string;
}

export interface RemoteRoastProfileMutationRecord {
  id: string;
}

export interface RemoteRoastBatchPlanRelationRecord {
  id: string;
}

export interface RemoteGreenBeanLookupRecord {
  id: string;
}

export interface RemoteRoastPlanStepRecord {
  airTemperature?: string;
  drumSpeed?: string;
  event?: string;
  firePower?: string;
  note?: string;
  operation?: string;
  temperature?: string;
  time?: string;
}
