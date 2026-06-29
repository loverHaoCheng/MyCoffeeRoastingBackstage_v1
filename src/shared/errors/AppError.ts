export type AppErrorCode =
  | 'NETWORK'
  | 'HTTP'
  | 'BUSINESS'
  | 'UNKNOWN'
  | 'AUTH'
  | 'CONFIG'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'DATA';

export interface AppErrorOptions {
  code: AppErrorCode;
  status?: number;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status?: number;
  override readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.code = options.code;
    this.status = options.status;
    this.cause = options.cause;
  }
}
