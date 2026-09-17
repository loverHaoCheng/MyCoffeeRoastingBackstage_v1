import { sortByDateDesc } from '@/shared/utils/sort.utils';
import { createSyncSnapshot } from '@/shared/utils/sync.utils';
import type { FinanceExpenseRecord, FinanceIncomeRecord } from '../../types';

let currentExpenseRecords: FinanceExpenseRecord[] = [];
let currentIncomeRecords: FinanceIncomeRecord[] = [];

const sortByUpdatedAt = <TRecord extends { updatedAt: string }>(records: TRecord[]): TRecord[] => {
  return sortByDateDesc(records);
};

export const getLedgerSyncSnapshot = (records: { id: string; updatedAt: string }[]): string => {
  return createSyncSnapshot(records);
};

export const setCurrentExpenseRecords = (records: FinanceExpenseRecord[]): FinanceExpenseRecord[] => {
  currentExpenseRecords = sortByUpdatedAt(records);
  return currentExpenseRecords;
};

export const setCurrentIncomeRecords = (records: FinanceIncomeRecord[]): FinanceIncomeRecord[] => {
  currentIncomeRecords = sortByUpdatedAt(records);
  return currentIncomeRecords;
};

export const getCurrentExpenseRecords = (): FinanceExpenseRecord[] => {
  return currentExpenseRecords;
};

export const getCurrentIncomeRecords = (): FinanceIncomeRecord[] => {
  return currentIncomeRecords;
};

export const clearCurrentRecords = (): void => {
  currentExpenseRecords = [];
  currentIncomeRecords = [];
};
