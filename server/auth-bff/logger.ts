type LogContext = Record<string, boolean | number | string | null | undefined>;

export const getSafeUpstreamErrorMessage = (payload: unknown): string => {
  if (typeof payload !== 'object' || payload == null) {
    return '';
  }

  const record = payload as Record<string, unknown>;
  const nestedError = typeof record.error === 'object' && record.error != null
    ? record.error as Record<string, unknown>
    : null;
  const message = typeof record.message === 'string'
    ? record.message
    : nestedError && typeof nestedError.message === 'string'
      ? nestedError.message
      : '';

  return message.trim().slice(0, 240);
};

const write = (level: string, event: string, context: LogContext): void => {
  process.stderr.write(`${JSON.stringify({ context, event, level, timestamp: new Date().toISOString() })}\n`);
};

export const logger = {
  debug: (event: string, context: LogContext = {}) => { write('debug', event, context); },
  error: (event: string, context: LogContext = {}) => { write('error', event, context); },
  info: (event: string, context: LogContext = {}) => { write('info', event, context); },
  warn: (event: string, context: LogContext = {}) => { write('warn', event, context); },
};
