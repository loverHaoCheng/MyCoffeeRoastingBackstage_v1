import { create } from 'zustand';

import {
  createRoastPlan,
  createRoastPlanFromJson,
  updateRoastPlanFromInput,
} from '@/modules/roast/services/roastPlanJson.service';
import { AppError } from '@/shared/errors/AppError';
import type { RoastPlanJsonInput } from '@/modules/roast/types';
import type { RoastPlan } from '@/types/domain';

interface RoastPlanState {
  plans: RoastPlan[];
  selectedPlanId: RoastPlan['id'];
  addPlan: (input: RoastPlanJsonInput) => RoastPlan;
  addPlanFromJson: (jsonText: string) => RoastPlan;
  deletePlan: (planId: RoastPlan['id']) => void;
  selectPlan: (planId: RoastPlan['id']) => void;
  updatePlan: (planId: RoastPlan['id'], input: RoastPlanJsonInput) => RoastPlan;
}

export const useRoastPlanStore = create<RoastPlanState>((set, get) => ({
  plans: [],
  selectedPlanId: 0,
  addPlan: (input) => {
    const nextId = Math.max(0, ...get().plans.map((plan) => (typeof plan.id === 'number' ? plan.id : 0))) + 1;
    const plan = createRoastPlan(input, nextId);

    set((state) => ({
      plans: [plan, ...state.plans],
      selectedPlanId: plan.id,
    }));

    return plan;
  },
  addPlanFromJson: (jsonText) => {
    const nextId = Math.max(0, ...get().plans.map((plan) => (typeof plan.id === 'number' ? plan.id : 0))) + 1;
    const plan = createRoastPlanFromJson(jsonText, nextId);

    set((state) => ({
      plans: [plan, ...state.plans],
      selectedPlanId: plan.id,
    }));

    return plan;
  },
  deletePlan: (planId) => {
    set((state) => {
      const nextPlans = state.plans.filter((plan) => plan.id !== planId);
      const nextSelectedPlanId =
        state.selectedPlanId === planId ? (nextPlans[0]?.id ?? 0) : state.selectedPlanId;

      return {
        plans: nextPlans,
        selectedPlanId: nextSelectedPlanId,
      };
    });
  },
  selectPlan: (planId) => {
    set({ selectedPlanId: planId });
  },
  updatePlan: (planId, input) => {
    const currentPlan = get().plans.find((plan) => plan.id === planId);

    if (!currentPlan) {
      throw new AppError('烘焙计划不存在', { code: 'BUSINESS' });
    }

    const nextPlan = updateRoastPlanFromInput(currentPlan, input);

    set((state) => ({
      plans: state.plans.map((plan) => (plan.id === planId ? nextPlan : plan)),
      selectedPlanId: nextPlan.id,
    }));

    return nextPlan;
  },
}));
