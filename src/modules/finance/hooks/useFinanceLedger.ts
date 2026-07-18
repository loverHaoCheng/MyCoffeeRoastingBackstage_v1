import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError } from '@/shared/errors/AppError';

import { financeLedgerService } from '../services';
import type {
  FinanceExpenseFormInput,
  FinanceExpenseRecord,
  FinanceIncomeFormInput,
  FinanceIncomeRecord,
} from '../types';
import { financeQueryKeys } from './useCostCalculations';

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof AppError) {
    if (error.code === 'AUTH' || error.code === 'CONFIG' || error.code === 'DATA') {
      return false;
    }
  }

  return failureCount < 2;
};

export function useFinanceExpenseRecords(enabled = true) {
  const initialRecords = financeLedgerService.getBootstrappedExpenseRecords();

  return useQuery({
    enabled,
    initialData: initialRecords.length > 0 ? initialRecords : undefined,
    queryKey: financeQueryKeys.expenses(),
    queryFn: async () => {
      const response = await financeLedgerService.listExpenseRecords();

      return response.data;
    },
    retry: shouldRetry,
  });
}

export function useFinanceIncomeRecords(enabled = true) {
  const initialRecords = financeLedgerService.getBootstrappedIncomeRecords();

  return useQuery({
    enabled,
    initialData: initialRecords.length > 0 ? initialRecords : undefined,
    queryKey: financeQueryKeys.incomes(),
    queryFn: async () => {
      const response = await financeLedgerService.listIncomeRecords();

      return response.data;
    },
    retry: shouldRetry,
  });
}

export function useSaveFinanceExpenseRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: FinanceExpenseFormInput) => {
      const response = await financeLedgerService.saveExpenseRecord(input);

      return response.data;
    },
    onSuccess: (nextRecord) => {
      queryClient.setQueryData<FinanceExpenseRecord[]>(financeQueryKeys.expenses(), (current = []) => {
        return [nextRecord, ...current.filter((record) => record.id !== nextRecord.id)];
      });
    },
  });
}

export function useSaveFinanceIncomeRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: FinanceIncomeFormInput) => {
      const response = await financeLedgerService.saveIncomeRecord(input);

      return response.data;
    },
    onSuccess: (nextRecord) => {
      queryClient.setQueryData<FinanceIncomeRecord[]>(financeQueryKeys.incomes(), (current = []) => {
        return [nextRecord, ...current.filter((record) => record.id !== nextRecord.id)];
      });
    },
  });
}

export function useDeleteFinanceExpenseRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseRecordId: string) => {
      await financeLedgerService.deleteExpenseRecord(expenseRecordId);

      return expenseRecordId;
    },
    onSuccess: (deletedExpenseRecordId) => {
      queryClient.setQueryData<FinanceExpenseRecord[]>(financeQueryKeys.expenses(), (current = []) => {
        return current.filter((record) => record.id !== deletedExpenseRecordId);
      });
    },
  });
}

export function useDeleteFinanceIncomeRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (incomeRecordId: string) => {
      await financeLedgerService.deleteIncomeRecord(incomeRecordId);

      return incomeRecordId;
    },
    onSuccess: (deletedIncomeRecordId) => {
      queryClient.setQueryData<FinanceIncomeRecord[]>(financeQueryKeys.incomes(), (current = []) => {
        return current.filter((record) => record.id !== deletedIncomeRecordId);
      });
    },
  });
}
