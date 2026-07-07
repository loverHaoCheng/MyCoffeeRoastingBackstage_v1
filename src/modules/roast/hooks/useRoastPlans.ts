import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { seedRoastPlans } from '@/modules/roast/constants/roastPlan.mock';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { updateRoastPlanFromInput } from '@/modules/roast/services/roastPlanJson.service';
import { AppError } from '@/shared/errors/AppError';
import type { RoastPlan } from '@/types/domain';

import type { RoastPlanJsonInput } from '../types';

export const roastPlanQueryKeys = {
  all: ['roast-plans'] as const,
  list: () => [...roastPlanQueryKeys.all, 'list'] as const,
};

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof AppError) {
    if (error.code === 'AUTH' || error.code === 'CONFIG' || error.code === 'DATA') {
      return false;
    }
  }

  return failureCount < 2;
};

const sortPlansByUpdatedAt = (plans: RoastPlan[]): RoastPlan[] => {
  return [...plans].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
};

export function useRoastPlans() {
  const initialPlans =
    import.meta.env.MODE === 'test' ? seedRoastPlans : roastPlanService.getBootstrappedPlans();

  return useQuery({
    initialData: initialPlans.length > 0 ? initialPlans : undefined,
    queryKey: roastPlanQueryKeys.list(),
    queryFn: async () => {
      const response = await roastPlanService.listPlans();

      return response.data;
    },
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

export function useCreateRoastPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RoastPlanJsonInput) => {
      const response = await roastPlanService.createPlan(input);

      return response.data;
    },
    onSuccess: (nextPlan) => {
      queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), (current = []) =>
        sortPlansByUpdatedAt([
          nextPlan,
          ...current.filter((plan) => String(plan.id) !== String(nextPlan.id)),
        ]),
      );
    },
  });
}

export function useCreateRoastPlanFromJson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jsonText: string) => {
      const response = await roastPlanService.createPlanFromJson(jsonText);

      return response.data;
    },
    onSuccess: (nextPlan) => {
      queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), (current = []) =>
        sortPlansByUpdatedAt([
          nextPlan,
          ...current.filter((plan) => String(plan.id) !== String(nextPlan.id)),
        ]),
      );
    },
  });
}

export function useUpdateRoastPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { input: RoastPlanJsonInput; planId: RoastPlan['id'] }) => {
      const response = await roastPlanService.updatePlan(variables.planId, variables.input);

      return response.data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: roastPlanQueryKeys.list() });

      const previousPlans = queryClient.getQueryData<RoastPlan[]>(roastPlanQueryKeys.list());
      const currentPlan = previousPlans?.find((plan) => String(plan.id) === String(variables.planId));

      if (currentPlan) {
        const nextPlan = updateRoastPlanFromInput(currentPlan, variables.input);

        queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), (current = []) =>
          sortPlansByUpdatedAt(
            current.map((plan) => (String(plan.id) === String(variables.planId) ? nextPlan : plan)),
          ),
        );
      }

      return { previousPlans };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousPlans) {
        queryClient.setQueryData(roastPlanQueryKeys.list(), context.previousPlans);
      }
    },
    onSuccess: (nextPlan, variables) => {
      queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), (current = []) =>
        sortPlansByUpdatedAt(
          current.map((plan) => (String(plan.id) === String(variables.planId) ? nextPlan : plan)),
        ),
      );
    },
  });
}

export function useDeleteRoastPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: RoastPlan['id']) => {
      await roastPlanService.deletePlan(planId);
    },
    onMutate: async (planId) => {
      await queryClient.cancelQueries({ queryKey: roastPlanQueryKeys.list() });

      const previousPlans = queryClient.getQueryData<RoastPlan[]>(roastPlanQueryKeys.list());
      const removedPlan =
        previousPlans?.find((plan) => String(plan.id) === String(planId)) ??
        roastPlanService.removeOptimisticPlan(planId);
      queryClient.setQueryData<RoastPlan[]>(
        roastPlanQueryKeys.list(),
        (current = []) => current.filter((plan) => String(plan.id) !== String(planId)),
      );

      return { previousPlans, removedPlan };
    },
    onError: (_error, _planId, context) => {
      if (context?.previousPlans) {
        queryClient.setQueryData(roastPlanQueryKeys.list(), context.previousPlans);
      }

      if (context?.removedPlan) {
        roastPlanService.restoreOptimisticPlan(context.removedPlan);
      }
    },
    onSuccess: (_result, planId) => {
      queryClient.setQueryData<RoastPlan[]>(
        roastPlanQueryKeys.list(),
        (current = []) => current.filter((plan) => String(plan.id) !== String(planId)),
      );
    },
  });
}
