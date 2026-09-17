import type { FinanceOverviewDetailItem } from '../../types';

export const sortOverviewDetailRecords = (records: FinanceOverviewDetailItem[]): FinanceOverviewDetailItem[] => {
  return [...records].sort((left, right) => {
    if (left.date === right.date) {
      return right.id.localeCompare(left.id);
    }

    return right.date.localeCompare(left.date);
  });
};
