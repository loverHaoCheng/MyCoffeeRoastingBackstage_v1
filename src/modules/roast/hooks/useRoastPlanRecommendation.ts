import { useMutation } from '@tanstack/react-query';

import { roastPlanRecommendationService } from '@/modules/roast/services/roastPlanRecommendation.service';

import type { RoastPlanRecommendationInput } from '../types';

export function useRoastPlanRecommendation() {
  return useMutation({
    mutationFn: async (input: RoastPlanRecommendationInput) => {
      const response = await roastPlanRecommendationService.recommend(input);

      return response.data.recommendation;
    },
  });
}
