import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { roastCurveService } from '../services/roastCurve.service';
import type { RoastCurveImportInput, RoastCurveRecord } from '../types/roastCurve';

export const roastCurveQueryKeys = {
  all: ['roast-curves'] as const,
  detail: (roastBatchId: string) => [...roastCurveQueryKeys.all, 'detail', roastBatchId] as const,
};

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof Error && 'code' in error) {
    const code = (error as { code: string }).code;
    if (code === 'AUTH' || code === 'CONFIG' || code === 'DATA') return false;
  }

  return failureCount < 2;
};

export function useRoastCurve(roastBatchId: string | undefined) {
  return useQuery({
    enabled: Boolean(roastBatchId),
    queryFn: async () => {
      const response = await roastCurveService.getByBatchId(roastBatchId ?? '');
      return response.data;
    },
    queryKey: roastCurveQueryKeys.detail(roastBatchId ?? ''),
    retry: shouldRetry,
  });
}

export function useImportHiBeanRoastCurve() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RoastCurveImportInput) => {
      const response = await roastCurveService.importHiBeanCurve(input);
      return response.data;
    },
    onSuccess: (result) => {
      queryClient.setQueryData<RoastCurveRecord>(
        roastCurveQueryKeys.detail(result.record.roastBatchId),
        result.record,
      );
    },
  });
}
