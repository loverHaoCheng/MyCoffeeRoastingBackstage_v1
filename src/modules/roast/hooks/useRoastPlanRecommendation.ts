import { useMutation, useQueryClient } from '@tanstack/react-query';

import { roastPlanRecommendationService } from '@/modules/roast/services/roastPlanRecommendation.service';

import type { RoastPlanRecommendationInput } from '../types';
import { roastAiUsageQueryKeys } from './useRoastAiUsage';

export function useRoastPlanRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RoastPlanRecommendationInput) => {
      const response = await roastPlanRecommendationService.recommend(input);

      return response.data.recommendation;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: roastAiUsageQueryKeys.feature('roast_plan_recommendation'),
      });
    },
  });
}
