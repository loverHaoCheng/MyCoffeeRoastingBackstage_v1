type LogMeta = Record<string, unknown>;

const isDev = import.meta.env.DEV;
const isTest = import.meta.env.MODE === 'test';

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    if (isDev && !isTest) {
      globalThis.console.debug(message, meta);
    }
  },
  info(message: string, meta?: LogMeta): void {
    if (isDev && !isTest) {
      globalThis.console.info(message, meta);
    }
  },
  warn(message: string, meta?: LogMeta): void {
    if (!isTest) {
      globalThis.console.warn(message, meta);
    }
  },
  error(message: string, meta?: LogMeta): void {
    if (!isTest) {
      globalThis.console.error(message, meta);
    }
  },
};
