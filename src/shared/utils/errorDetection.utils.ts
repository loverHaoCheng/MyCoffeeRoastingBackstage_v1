import { AppError } from '@/shared/errors/AppError';

/**
 * Error detection utilities
 */

/**
 * Check if error represents a missing remote resource (404, PGRST error, or "不存在" message)
 */
export function isMissingRemoteResourceError(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return false;
  }

  const cause = error.cause;
  const payload =
    typeof cause === 'object' && cause != null ? (cause as { code?: string; message?: string }) : null;
  const message = payload?.message ?? error.message;

  return (
    error.status === 404 || payload?.code?.startsWith('PGRST') === true || message.includes('不存在')
  );
}
