/**
 * Text normalization utilities
 */

/**
 * Normalize text input - trim and return null if empty
 */
export const normalizeText = (value: null | string | undefined): null | string => {
  const nextValue = value?.trim() ?? '';
  return nextValue.length > 0 ? nextValue : null;
};

/**
 * Get non-empty string or undefined
 */
export const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};
