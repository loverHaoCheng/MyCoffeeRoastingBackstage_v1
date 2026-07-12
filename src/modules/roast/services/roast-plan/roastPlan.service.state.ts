import { seedRoastPlans } from '@/modules/roast/constants/roastPlan.mock';
import type { RoastPlan } from '@/types/domain';

export type RoastPlanStatus = RoastPlan['status'];

export const ROAST_PLAN_STATUS_SET = new Set<RoastPlanStatus>(['draft', 'inProgress', 'completed', 'cancelled']);
export const GENERIC_BEAN_ID = 'generic';
export const GENERIC_BEAN_NAME = '通用';
const STORAGE_KEY = 'coffee-roasting-backstage:roast-plans';

const loadLocalPlans = (): RoastPlan[] => {
  void STORAGE_KEY;
  return [];
};

export const sortPlans = (plans: RoastPlan[]): RoastPlan[] => {
  return [...plans].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
};

export const saveLocalPlans = (plans: RoastPlan[]): RoastPlan[] => {
  return sortPlans(plans);
};

export const createOptimisticLocalPlanId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const isOptimisticLocalPlanId = (planId: RoastPlan['id']): boolean => {
  return String(planId).startsWith('local-');
};

export const getPlanSyncSnapshot = (plans: RoastPlan[]): string => {
  return JSON.stringify(
    [...plans]
      .sort((left, right) => String(left.id).localeCompare(String(right.id)))
      .map((plan) => `${String(plan.id)}:${plan.updatedAt}`),
  );
};

export const roastPlanState = {
  localPlans:
    import.meta.env.MODE === 'test' ? sortPlans(seedRoastPlans) : loadLocalPlans(),
  pendingOptimisticCreatePlanIds: new Set<string>(),
  pendingOptimisticDeletePlanIds: new Set<string>(),
};
