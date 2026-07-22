import { httpClient } from '@/services/httpClient';
import type { ApiResponse } from '@/services/api.types';

import type {
  RoastTrainingRecommendationConfirmResult,
  RoastTrainingUploadResult,
  RoastTrainingUploadStatus,
} from '../types/roastTraining';

export const EASYBAKE_APP_ENV_STAGING = 'staging';

export const isRoastAiClientEnabled = (): boolean => {
  return import.meta.env.MODE === 'test' || import.meta.env.VITE_EASYBAKE_APP_ENV === EASYBAKE_APP_ENV_STAGING;
};

export const isRoastTrainingUploadClientEnabled = (): boolean => {
  return isRoastAiClientEnabled();
};

export const roastTrainingUploadService = {
  getStatus(roastBatchId: string): Promise<ApiResponse<RoastTrainingUploadStatus>> {
    const searchParams = new URLSearchParams({ roastBatchId });

    return httpClient.get<RoastTrainingUploadStatus>(`/ai/roast-training-upload?${searchParams.toString()}`);
  },

  upload(roastBatchId: string): Promise<ApiResponse<RoastTrainingUploadResult>> {
    return httpClient.post<RoastTrainingUploadResult>('/ai/roast-training-upload', {
      roastBatchId,
    });
  },

  confirmRecommendation(
    recommendationId: string,
    confirmedPlanId: string,
  ): Promise<ApiResponse<RoastTrainingRecommendationConfirmResult>> {
    return httpClient.post<RoastTrainingRecommendationConfirmResult>('/ai/roast-training-upload/confirm', {
      confirmedPlanId,
      recommendationId,
    });
  },
};
