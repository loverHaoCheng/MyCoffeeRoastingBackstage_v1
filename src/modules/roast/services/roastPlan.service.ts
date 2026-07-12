import type { ApiResponse } from '@/services/api.types';
import type { RoastPlan } from '@/types/domain';

import type { RoastPlanJsonInput } from '../types';
import { hasGreenBeanConnection, ok } from './roast-plan/roastPlan.service.shared';
import {
  roastPlanOptimisticHelpers,
  resolveRoastPlanRepository,
} from './roast-plan/roastPlan.service.repositories';
import { roastPlanState, saveLocalPlans, sortPlans } from './roast-plan/roastPlan.service.state';

export const roastPlanService = {
  getBootstrappedPlans(): RoastPlan[] {
    return sortPlans(roastPlanState.localPlans);
  },
  createOptimisticPlan(input: RoastPlanJsonInput): RoastPlan {
    return roastPlanOptimisticHelpers.createOptimisticPlan(input);
  },
  createOptimisticPlanFromJson(jsonText: string): RoastPlan {
    return roastPlanOptimisticHelpers.createOptimisticPlanFromJson(jsonText);
  },
  removeOptimisticPlan(planId: RoastPlan['id']): RoastPlan | null {
    const nextPlanId = String(planId);
    const removedPlan = roastPlanState.localPlans.find((plan) => String(plan.id) === nextPlanId) ?? null;

    roastPlanState.localPlans = saveLocalPlans(
      roastPlanState.localPlans.filter((plan) => String(plan.id) !== nextPlanId),
    );

    return removedPlan;
  },
  beginOptimisticDelete(planId: RoastPlan['id']): RoastPlan | null {
    const nextPlanId = String(planId);

    roastPlanState.pendingOptimisticDeletePlanIds.add(nextPlanId);

    return this.removeOptimisticPlan(planId);
  },
  finalizeOptimisticDelete(planId: RoastPlan['id']): RoastPlan[] {
    roastPlanState.pendingOptimisticDeletePlanIds.delete(String(planId));
    this.removeOptimisticPlan(planId);

    return sortPlans(roastPlanState.localPlans);
  },
  rollbackOptimisticDelete(planId: RoastPlan['id'], plan: RoastPlan | null): RoastPlan[] {
    roastPlanState.pendingOptimisticDeletePlanIds.delete(String(planId));

    return plan ? this.restoreOptimisticPlan(plan) : sortPlans(roastPlanState.localPlans);
  },
  restoreOptimisticPlan(plan: RoastPlan): RoastPlan[] {
    roastPlanState.localPlans = saveLocalPlans([
      plan,
      ...roastPlanState.localPlans.filter((currentPlan) => String(currentPlan.id) !== String(plan.id)),
    ]);

    return sortPlans(roastPlanState.localPlans);
  },
  finalizeOptimisticPlan(optimisticPlanId: RoastPlan['id'], remotePlan: RoastPlan): RoastPlan[] {
    roastPlanState.pendingOptimisticCreatePlanIds.delete(String(optimisticPlanId));
    roastPlanState.localPlans = saveLocalPlans([
      remotePlan,
      ...roastPlanState.localPlans.filter((plan) => String(plan.id) !== String(optimisticPlanId)),
    ]);

    return sortPlans(roastPlanState.localPlans);
  },
  rollbackOptimisticPlan(optimisticPlanId: RoastPlan['id']): RoastPlan[] {
    roastPlanState.pendingOptimisticCreatePlanIds.delete(String(optimisticPlanId));
    roastPlanState.localPlans = saveLocalPlans(
      roastPlanState.localPlans.filter((plan) => String(plan.id) !== String(optimisticPlanId)),
    );

    return sortPlans(roastPlanState.localPlans);
  },
  createPlan(input: RoastPlanJsonInput): Promise<ApiResponse<RoastPlan>> {
    return resolveRoastPlanRepository().createPlan(input);
  },
  createPlanFromJson(jsonText: string): Promise<ApiResponse<RoastPlan>> {
    return resolveRoastPlanRepository().createPlanFromJson(jsonText);
  },
  deletePlan(planId: RoastPlan['id']): Promise<ApiResponse<null>> {
    return resolveRoastPlanRepository().deletePlan(planId);
  },
  async listPlans(): Promise<ApiResponse<RoastPlan[]>> {
    const response = await resolveRoastPlanRepository().listPlans();
    const visiblePlans = response.data.filter(
      (plan) => !roastPlanState.pendingOptimisticDeletePlanIds.has(String(plan.id)),
    );

    roastPlanState.localPlans = saveLocalPlans(visiblePlans);

    return {
      ...response,
      data: visiblePlans,
    };
  },
  updatePlan(planId: RoastPlan['id'], input: RoastPlanJsonInput): Promise<ApiResponse<RoastPlan>> {
    return resolveRoastPlanRepository().updatePlan(planId, input);
  },
  syncLocalAndRemote(): Promise<{ downloaded: number; uploaded: number }> {
    return roastPlanOptimisticHelpers.syncLocalAndRemote();
  },
  hasPendingOptimisticCreations(): boolean {
    return roastPlanState.pendingOptimisticCreatePlanIds.size > 0;
  },
  hasPendingOptimisticDeletions(): boolean {
    return roastPlanState.pendingOptimisticDeletePlanIds.size > 0;
  },
  hasGreenBeanConnection,
  ok,
};
