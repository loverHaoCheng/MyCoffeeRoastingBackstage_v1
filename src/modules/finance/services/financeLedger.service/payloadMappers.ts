import { normalizeText } from '@/shared/utils/text.utils';
import type { FinanceExpenseFormInput, FinanceIncomeFormInput } from '../../types';
import { normalizeExpenseInput, normalizeIncomeInput } from './normalizeInput';

const createLedgerTimestamps = (): { createdAt: string; updatedAt: string } => {
  const timestamp = new Date().toISOString();

  return {
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const mapExpenseInputToRemotePayload = (input: FinanceExpenseFormInput) => {
  const timestamps = createLedgerTimestamps();
  const normalizedInput = normalizeExpenseInput(input);

  return {
    amount: normalizedInput.amount,
    category: normalizedInput.category,
    created_at: timestamps.createdAt,
    custom_category_label: normalizeText(normalizedInput.customCategoryLabel),
    expense_date: normalizedInput.expenseDate,
    notes: normalizeText(normalizedInput.notes),
    roast_batch_ids: normalizedInput.roastBatchIds ?? [],
    source: 'manual' as const,
    source_entity_id: null,
    status: normalizedInput.status,
    title: normalizedInput.title.trim(),
    updated_at: timestamps.updatedAt,
  };
};

export const mapIncomeInputToRemotePayload = (input: FinanceIncomeFormInput) => {
  const timestamps = createLedgerTimestamps();
  const normalizedInput = normalizeIncomeInput(input);

  return {
    amount: normalizedInput.amount,
    channel: normalizedInput.channel,
    created_at: timestamps.createdAt,
    income_date: normalizedInput.incomeDate,
    notes: normalizeText(normalizedInput.notes),
    status: normalizedInput.status,
    title: normalizedInput.title.trim(),
    updated_at: timestamps.updatedAt,
  };
};
