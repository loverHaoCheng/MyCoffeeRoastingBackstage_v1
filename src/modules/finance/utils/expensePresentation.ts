import type { FinanceExpenseCategory } from '../types';

const normalizeCustomCategoryLabel = (customCategoryLabel?: null | string): null | string => {
  const normalizedLabel = customCategoryLabel?.trim() ?? '';

  return normalizedLabel.length > 0 ? normalizedLabel : null;
};

export const financeExpenseCategoryOptions: { label: string; value: FinanceExpenseCategory }[] = [
  { label: '包装', value: 'packaging' },
  { label: '邮费', value: 'shipping' },
  { label: '折旧', value: 'depreciation' },
  { label: '其他', value: 'other' },
  { label: '自定义', value: 'custom' },
];

export const getFinanceExpenseCategoryLabel = (
  category: FinanceExpenseCategory,
  customCategoryLabel?: null | string,
): string => {
  if (category === 'packaging') {
    return '包装';
  }

  if (category === 'shipping') {
    return '邮费';
  }

  if (category === 'depreciation') {
    return '折旧';
  }

  if (category === 'other') {
    return '其他';
  }

  if (category === 'custom') {
    return normalizeCustomCategoryLabel(customCategoryLabel) ?? '自定义';
  }

  return '支出';
};

export const buildFinanceExpenseTitle = (
  category: FinanceExpenseCategory,
  customCategoryLabel?: null | string,
): string => {
  if (category === 'custom') {
    return normalizeCustomCategoryLabel(customCategoryLabel) ?? '自定义支出';
  }

  return `${getFinanceExpenseCategoryLabel(category)}支出`;
};
