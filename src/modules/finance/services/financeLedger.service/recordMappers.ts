import type { FinanceExpenseRecord, FinanceIncomeRecord } from '../../types';
import type { RemoteFinanceExpenseRecord, RemoteFinanceIncomeRecord } from './types';

export const mapRemoteExpenseRecord = (record: RemoteFinanceExpenseRecord): FinanceExpenseRecord => ({
  amount: record.amount,
  category: record.category,
  createdAt: record.created_at,
  customCategoryLabel: record.custom_category_label,
  expenseDate: record.expense_date,
  id: record.id,
  notes: record.notes,
  roastBatchIds: record.roast_batch_ids ?? [],
  source: record.source,
  sourceEntityId: record.source_entity_id,
  status: record.status,
  title: record.title,
  updatedAt: record.updated_at,
});

export const mapRemoteIncomeRecord = (record: RemoteFinanceIncomeRecord): FinanceIncomeRecord => ({
  amount: record.amount,
  channel: record.channel,
  createdAt: record.created_at,
  id: record.id,
  incomeDate: record.income_date,
  notes: record.notes,
  source: record.source ?? 'manual',
  sourceEntityId: record.source_entity_id ?? null,
  status: record.status,
  title: record.title,
  updatedAt: record.updated_at,
});
