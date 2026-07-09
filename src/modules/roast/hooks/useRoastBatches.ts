import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { roastBatchService } from '../services/roastBatch.service';
import type { RoastBatchCreateInput, RoastBatchUpdateInput } from '../types/roastBatch';
import type { RoastBatchRecord } from '../types/roastBatch';

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

const sortBatchesByRoastDate = (batches: RoastBatchRecord[]): RoastBatchRecord[] => {
  return [...batches].sort((left, right) => {
    return new Date(right.roastDate).getTime() - new Date(left.roastDate).getTime();
  });
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
    onSuccess: (nextBatch) => {
      queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), (current = []) =>
        sortBatchesByRoastDate([
          nextBatch,
          ...current.filter((batch) => batch.id !== nextBatch.id),
        ]),
      );
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
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: roastBatchQueryKeys.list() });

      const previousBatches = queryClient.getQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list());
      const isSalesModeUpdate = variables.input.salesMode !== undefined;

      if (isSalesModeUpdate) {
        return { previousBatches };
      }

      const currentBatch = previousBatches?.find((batch) => batch.id === variables.batchId);

      if (currentBatch) {
        const nextBatch: RoastBatchRecord = {
          ...currentBatch,
          ...variables.input,
          roastedBeanName:
            variables.input.roastedBeanName ?? currentBatch.roastedBeanName ?? currentBatch.greenBeanName,
          salesMode: variables.input.salesMode ?? currentBatch.salesMode,
          status: variables.input.status ?? currentBatch.status,
          updatedAt: new Date().toISOString(),
        };

        queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), (current = []) =>
          sortBatchesByRoastDate(
            current.map((batch) => (batch.id === variables.batchId ? nextBatch : batch)),
          ),
        );
      }

      return { previousBatches };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousBatches) {
        queryClient.setQueryData(roastBatchQueryKeys.list(), context.previousBatches);
      }
    },
    onSuccess: (nextBatch, variables) => {
      queryClient.setQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list(), (current = []) =>
        sortBatchesByRoastDate(current.map((batch) => (batch.id === variables.batchId ? nextBatch : batch))),
      );
      void queryClient.invalidateQueries({ queryKey: roastBatchQueryKeys.list() });
    },
  });
}

export function useDeleteRoastBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string) => {
      await roastBatchService.deleteBatch(batchId);
    },
    onMutate: async (batchId) => {
      await queryClient.cancelQueries({ queryKey: roastBatchQueryKeys.list() });

      const previousBatches = queryClient.getQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list());
      const removedBatch =
        previousBatches?.find((batch) => batch.id === batchId) ??
        roastBatchService.removeOptimisticBatch(batchId);
      queryClient.setQueryData<RoastBatchRecord[]>(
        roastBatchQueryKeys.list(),
        (current = []) => current.filter((batch) => batch.id !== batchId),
      );

      return { previousBatches, removedBatch };
    },
    onError: (_error, _batchId, context) => {
      if (context?.previousBatches) {
        queryClient.setQueryData(roastBatchQueryKeys.list(), context.previousBatches);
      }

      if (context?.removedBatch) {
        roastBatchService.restoreOptimisticBatch(context.removedBatch);
      }
    },
    onSuccess: (_result, batchId) => {
      queryClient.setQueryData<RoastBatchRecord[]>(
        roastBatchQueryKeys.list(),
        (current = []) => current.filter((batch) => batch.id !== batchId),
      );
    },
  });
}
