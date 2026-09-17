import { toShanghaiDateString } from '@/shared/time/shanghaiTime';

export const createDateTextFromUtcDate = (value: Date): string => {
  return value.toISOString().slice(0, 10);
};

export const createUtcDateFromDateText = (dateText: string): Date => {
  const [year = '1970', month = '01', day = '01'] = dateText.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
};

export const shiftDateText = (dateText: string, offsetDays: number): string => {
  const nextValue = createUtcDateFromDateText(dateText);

  nextValue.setUTCDate(nextValue.getUTCDate() + offsetDays);

  return createDateTextFromUtcDate(nextValue);
};

export const getDayOfWeekFromDateText = (dateText: string): number => {
  return createUtcDateFromDateText(dateText).getUTCDay();
};

export const getYearFromDateText = (dateText: string): string => {
  return dateText.slice(0, 4);
};

export const getYearMonthFromDateText = (dateText: string): string => {
  return dateText.slice(0, 7);
};

export const getFinanceDateTextFromTimestamp = (value: string): string => {
  return toShanghaiDateString(value) || value.slice(0, 10);
};
