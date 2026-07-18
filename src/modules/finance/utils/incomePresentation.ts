import type { FinanceIncomeChannel } from '../types';

export const financeIncomeChannelOptions: { label: string; value: FinanceIncomeChannel }[] = [
  { label: '零售', value: 'retail' },
  { label: '批发', value: 'wholesale' },
  { label: '其他', value: 'other' },
];

export const getFinanceIncomeChannelLabel = (channel: FinanceIncomeChannel): string => {
  if (channel === 'retail') {
    return '零售';
  }

  if (channel === 'wholesale') {
    return '批发';
  }

  return '其他';
};

export const buildFinanceIncomeTitle = (channel: FinanceIncomeChannel): string => {
  return `${getFinanceIncomeChannelLabel(channel)}收入`;
};
