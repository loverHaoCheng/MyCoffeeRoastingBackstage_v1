export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value != null;
};

export const toTrimmedString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};
