import type { FinanceExpenseRecord, FinanceIncomeRecord } from '../../types';

export const EXPENSE_COLLECTION = 'finance_expense_records';
export const INCOME_COLLECTION = 'finance_income_records';

export interface RemoteFinanceExpenseRecord {
  amount: number;
  category: FinanceExpenseRecord['category'];
  created_at: string;
  custom_category_label: null | string;
  expense_date: string;
  id: string;
  notes: null | string;
  roast_batch_ids?: string[];
  source: FinanceExpenseRecord['source'];
  source_entity_id: null | string;
  status: FinanceExpenseRecord['status'];
  title: string;
  updated_at: string;
}

export interface RemoteFinanceIncomeRecord {
  amount: number;
  channel: FinanceIncomeRecord['channel'];
  created_at: string;
  id: string;
  income_date: string;
  notes: null | string;
  source?: FinanceIncomeRecord['source'];
  source_entity_id?: null | string;
  status: FinanceIncomeRecord['status'];
  title: string;
  updated_at: string;
}
