import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  isRoastTrainingUploadClientEnabled,
  roastTrainingUploadService,
} from '../services/roastTrainingUpload.service';

export const roastTrainingUploadQueryKeys = {
  all: ['roast-training-upload'] as const,
  status: (roastBatchId: string) => [...roastTrainingUploadQueryKeys.all, 'status', roastBatchId] as const,
};

export function useRoastTrainingUploadStatus(roastBatchId: string | undefined) {
  return useQuery({
    enabled: Boolean(roastBatchId) && isRoastTrainingUploadClientEnabled(),
    queryFn: async () => {
      const response = await roastTrainingUploadService.getStatus(roastBatchId ?? '');
      return response.data;
    },
    queryKey: roastTrainingUploadQueryKeys.status(roastBatchId ?? ''),
    retry: false,
  });
}

export function useRoastTrainingUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roastBatchId: string) => {
      const response = await roastTrainingUploadService.upload(roastBatchId);
      return response.data;
    },
    onSuccess: (_result, roastBatchId) => {
      void queryClient.invalidateQueries({
        queryKey: roastTrainingUploadQueryKeys.status(roastBatchId),
      });
    },
  });
}
