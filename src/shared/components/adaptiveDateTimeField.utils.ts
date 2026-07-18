export type AdaptiveDateTimeMode = 'date' | 'datetime';

export interface AdaptiveDateTimeParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
}

const padNumber = (value: number): string => {
  return String(value).padStart(2, '0');
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

export const createDefaultAdaptiveDateTimeParts = (
  referenceDate = new Date(),
): AdaptiveDateTimeParts => {
  return {
    day: referenceDate.getDate(),
    hour: referenceDate.getHours(),
    minute: referenceDate.getMinutes(),
    month: referenceDate.getMonth() + 1,
    year: referenceDate.getFullYear(),
  };
};

export const normalizeAdaptiveDateTimeParts = (
  parts: AdaptiveDateTimeParts,
  mode: AdaptiveDateTimeMode,
): AdaptiveDateTimeParts => {
  const year = Number.isFinite(parts.year) ? Math.round(parts.year) : new Date().getFullYear();
  const month = clamp(Math.round(parts.month), 1, 12);
  const day = clamp(Math.round(parts.day), 1, getDaysInMonth(year, month));
  const hour = mode === 'datetime' ? clamp(Math.round(parts.hour), 0, 23) : 0;
  const minute = mode === 'datetime' ? clamp(Math.round(parts.minute), 0, 59) : 0;

  return {
    day,
    hour,
    minute,
    month,
    year,
  };
};

export const parseAdaptiveDateTimeValue = (
  value: string,
  mode: AdaptiveDateTimeMode,
): AdaptiveDateTimeParts | null => {
  if (!value.trim()) {
    return null;
  }

  if (mode === 'date') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
      return null;
    }

    const [, yearText, monthText, dayText] = match;
    const parsed = normalizeAdaptiveDateTimeParts(
      {
        day: Number(dayText),
        hour: 0,
        minute: 0,
        month: Number(monthText),
        year: Number(yearText),
      },
      mode,
    );

    return parsed;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return normalizeAdaptiveDateTimeParts(
    {
      day: parsedDate.getDate(),
      hour: parsedDate.getHours(),
      minute: parsedDate.getMinutes(),
      month: parsedDate.getMonth() + 1,
      year: parsedDate.getFullYear(),
    },
    mode,
  );
};

export const formatAdaptiveDateTimeDisplayValue = (
  parts: AdaptiveDateTimeParts,
  mode: AdaptiveDateTimeMode,
): string => {
  const dateLabel = `${String(parts.year)}-${padNumber(parts.month)}-${padNumber(parts.day)}`;

  if (mode === 'date') {
    return dateLabel;
  }

  return `${dateLabel} ${padNumber(parts.hour)}:${padNumber(parts.minute)}`;
};

export const serializeAdaptiveDateTimeValue = (
  parts: AdaptiveDateTimeParts,
  mode: AdaptiveDateTimeMode,
): string => {
  const normalized = normalizeAdaptiveDateTimeParts(parts, mode);

  if (mode === 'date') {
    return `${String(normalized.year)}-${padNumber(normalized.month)}-${padNumber(normalized.day)}`;
  }

  return new Date(
    normalized.year,
    normalized.month - 1,
    normalized.day,
    normalized.hour,
    normalized.minute,
    0,
    0,
  ).toISOString();
};

export const createAdaptiveDateTimeYearOptions = (
  selectedYear: number,
  referenceYear = new Date().getFullYear(),
): number[] => {
  const startYear = Math.min(selectedYear, referenceYear) - 15;
  const endYear = Math.max(selectedYear, referenceYear) + 5;

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
};
