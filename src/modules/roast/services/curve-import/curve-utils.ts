export const getFiniteNumber = (value: number | undefined): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

export const getFiniteUnknownNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

export const getValidTemperature = (value: unknown): number | undefined => {
  const numberValue = getFiniteUnknownNumber(value);

  return numberValue != null && numberValue > 0 ? numberValue : undefined;
};

export const getRecord = (value: unknown): Record<string, unknown> | undefined => {
  return typeof value === 'object' && value != null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
};

export const getNumberArray = (value: unknown): number[] => {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : [];
};

export const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

export const roundTimeSeconds = (value: number): number => Math.round(value * 1000) / 1000;

export const isValidArrayIndex = (index: number | undefined, length: number): index is number => {
  return index != null && Number.isInteger(index) && index >= 0 && index < length;
};

export const getParamValue = (params: { key: string; value: number }[] | undefined, key: string): number | undefined => {
  return getFiniteNumber(params?.find((item) => item.key === key)?.value);
};
