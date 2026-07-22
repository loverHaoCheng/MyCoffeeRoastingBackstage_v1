import type { ApiResponse } from '@/services/api.types';
import { httpClient } from '@/services/httpClient';

import type { RoastPlanRecommendationInput, RoastPlanRecommendationResult } from '../types';

export const roastPlanRecommendationService = {
  recommend(input: RoastPlanRecommendationInput): Promise<ApiResponse<RoastPlanRecommendationResult>> {
    return httpClient.post<RoastPlanRecommendationResult>('/ai/roast-plan-recommendation', input);
  },
};
