import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { roastBatchService } from '../services/roastBatch.service';
import type { RoastBatchCreateInput, RoastBatchRecord, RoastBatchUpdateInput } from '../types/roastBatch';

export const roastBatchQueryKeys = {
  all: ['roast-batches'] as const,
  list: () => [...roastBatchQueryKeys.all, 'list'] as const,
};

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof Error && 'code' in error) {
    const code = (error as { code: string }).code;
    if (code === 'AUTH' || code === 'CONFIG' || code === 'DATA') return false;
  }
  return failureCount < 2;
};

export function useRoastBatches() {
  return useQuery({
    queryKey: roastBatchQueryKeys.list(),
    queryFn: async () => {
      const response = await roastBatchService.listBatches();
      return response.data;
    },
    retry: shouldRetry,
  });
}

export function useCreateRoastBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RoastBatchCreateInput) => {
      const response = await roastBatchService.createBatch(input);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roastBatchQueryKeys.all });
    },
  });
}

export function useUpdateRoastBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, input }: { batchId: string; input: RoastBatchUpdateInput }) => {
      const response = await roastBatchService.updateBatch(batchId, input);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roastBatchQueryKeys.all });
    },
  });
}

export function useDeleteRoastBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string) => {
      await roastBatchService.deleteBatch(batchId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roastBatchQueryKeys.all });
    },
  });
}
