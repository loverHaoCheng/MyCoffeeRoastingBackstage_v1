const DEFAULT_AGING_DAYS = 14;
const DEFAULT_TASTING_END_DAYS = 40;

const normalizeRoundedNumber = (value: unknown): null | number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value);
};

export const normalizeAgingDays = (value: unknown): number => {
  const normalizedValue = normalizeRoundedNumber(value);

  if (normalizedValue == null || normalizedValue < 0) {
    return DEFAULT_AGING_DAYS;
  }

  return normalizedValue;
};

export const normalizeTastingEndDays = (
  value: unknown,
  agingDays: unknown,
): number => {
  const normalizedAgingDays = normalizeAgingDays(agingDays);
  const normalizedValue = normalizeRoundedNumber(value);

  if (normalizedValue == null || normalizedValue <= 0) {
    return Math.max(DEFAULT_TASTING_END_DAYS, normalizedAgingDays);
  }

  return Math.max(normalizedValue, normalizedAgingDays);
};

