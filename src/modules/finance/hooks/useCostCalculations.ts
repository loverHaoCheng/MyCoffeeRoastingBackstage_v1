import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeService } from '@/modules/finance/services';
import { AppError } from '@/shared/errors/AppError';

import type { CostCalculationFormInput } from '../types';

export const financeQueryKeys = {
  all: ['finance'] as const,
  calculations: () => [...financeQueryKeys.all, 'calculations'] as const,
  expenses: () => [...financeQueryKeys.all, 'expenses'] as const,
};

export function useCostCalculations(enabled = true) {
  const initialCalculations = financeService.getBootstrappedCalculations();

  return useQuery({
    enabled,
    initialData: initialCalculations.length > 0 ? initialCalculations : undefined,
    queryKey: financeQueryKeys.calculations(),
    queryFn: async () => {
      const response = await financeService.listCalculations();

      return response.data;
    },
    retry: (failureCount, error) => {
      if (error instanceof AppError) {
        if (error.code === 'CONFIG' || error.code === 'DATA' || error.code === 'AUTH') {
          return false;
        }
      }

      return failureCount < 2;
    },
  });
}

export function useSaveCostCalculation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CostCalculationFormInput) => {
      const response = await financeService.saveCalculation(input);

      return response.data;
    },
    onSuccess: (nextCalculation) => {
      queryClient.setQueryData(
        financeQueryKeys.calculations(),
        (current: ReturnType<typeof financeService.getBootstrappedCalculations> = []) =>
          [nextCalculation, ...current.filter((record) => record.id !== nextCalculation.id)].sort((left, right) => {
            return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
          }),
      );
    },
  });
}
