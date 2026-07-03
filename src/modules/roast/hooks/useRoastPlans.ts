import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { seedRoastPlans } from '@/modules/roast/constants/roastPlan.mock';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: roastPlanQueryKeys.all,
      });
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: roastPlanQueryKeys.all,
      });
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: roastPlanQueryKeys.all,
      });
    },
  });
}

export function useDeleteRoastPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: RoastPlan['id']) => {
      await roastPlanService.deletePlan(planId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: roastPlanQueryKeys.all,
      });
    },
  });
}
