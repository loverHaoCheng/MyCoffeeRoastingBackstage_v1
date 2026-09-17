import { normalizeText as sharedNormalizeText } from '@/shared/utils/text.utils';
import type { FinanceExpenseFormInput, FinanceIncomeFormInput } from '../../types';

const normalizeText = sharedNormalizeText;

export const normalizeExpenseInput = (input: FinanceExpenseFormInput): FinanceExpenseFormInput => ({
  ...input,
  customCategoryLabel: normalizeText(input.customCategoryLabel),
  notes: normalizeText(input.notes),
  roastBatchIds: input.roastBatchIds ?? [],
  title: input.title.trim(),
});

export const normalizeIncomeInput = (input: FinanceIncomeFormInput): FinanceIncomeFormInput => ({
  ...input,
  notes: normalizeText(input.notes),
  title: input.title.trim(),
});
