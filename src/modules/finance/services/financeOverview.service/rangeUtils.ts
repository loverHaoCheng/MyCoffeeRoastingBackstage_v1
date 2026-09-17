import type { FinanceDateRange, FinanceRangePreset } from '../../types';
import { toShanghaiDateString } from '@/shared/time/shanghaiTime';
import {
  createDateTextFromUtcDate,
  getDayOfWeekFromDateText,
  getYearFromDateText,
  getYearMonthFromDateText,
  shiftDateText,
} from './dateUtils';

export const isDateWithinFinanceRange = (dateText: string, range: FinanceDateRange): boolean => {
  return dateText >= range.startDate && dateText <= range.endDate;
};

export const resolveFinanceDateRange = (
  preset: FinanceRangePreset,
  customRange: FinanceDateRange | null,
  now = new Date(),
): FinanceDateRange => {
  const today = toShanghaiDateString(now) || createDateTextFromUtcDate(now);

  if (preset === 'custom' && customRange) {
    return customRange;
  }

  if (preset === 'all') {
    return {
      endDate: today,
      startDate: '1900-01-01',
    };
  }

  if (preset === 'today') {
    return {
      endDate: today,
      startDate: today,
    };
  }

  if (preset === 'week') {
    const dayOfWeek = getDayOfWeekFromDateText(today);
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    return {
      endDate: today,
      startDate: shiftDateText(today, mondayOffset),
    };
  }

  if (preset === 'year') {
    return {
      endDate: today,
      startDate: `${getYearFromDateText(today)}-01-01`,
    };
  }

  return {
    endDate: today,
    startDate: `${getYearMonthFromDateText(today)}-01`,
  };
};
