import type { ApiResponse } from './api.types';

/**
 * API response utilities
 */

/**
 * Create a successful API response wrapper
 */
export function ok<T>(data: T): ApiResponse<T> {
  return { code: 0, data, message: 'ok' };
}
