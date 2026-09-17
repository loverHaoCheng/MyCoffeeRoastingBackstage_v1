/**
 * Number normalization and validation utilities
 */

/**
 * Get finite number or fallback
 */
export const toFiniteNumber = (value: unknown, fallback = 0): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

/**
 * Get non-negative number (min 0)
 */
export const toNonNegativeNumber = (value: unknown, fallback = 0): number => {
  return Math.max(0, toFiniteNumber(value, fallback));
};

/**
 * Get positive number or null
 */
export const toPositiveNumberOrNull = (value: null | number | undefined): null | number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Get finite number or undefined
 */
export const getFiniteNumber = (value: number | undefined): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};
