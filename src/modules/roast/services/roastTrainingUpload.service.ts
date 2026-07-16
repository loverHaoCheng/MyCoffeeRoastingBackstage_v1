import { httpClient } from '@/services/httpClient';
import type { ApiResponse } from '@/services/api.types';

import type { RoastTrainingUploadResult, RoastTrainingUploadStatus } from '../types/roastTraining';

export const EASYBAKE_APP_ENV_STAGING = 'staging';

export const isRoastTrainingUploadClientEnabled = (): boolean => {
  return import.meta.env.VITE_EASYBAKE_APP_ENV === EASYBAKE_APP_ENV_STAGING;
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
};
