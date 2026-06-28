type LogMeta = Record<string, unknown>;

const isDev = import.meta.env.DEV;

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    if (isDev) {
      globalThis.console.debug(message, meta);
    }
  },
  info(message: string, meta?: LogMeta): void {
    if (isDev) {
      globalThis.console.info(message, meta);
    }
  },
  warn(message: string, meta?: LogMeta): void {
    globalThis.console.warn(message, meta);
  },
  error(message: string, meta?: LogMeta): void {
    globalThis.console.error(message, meta);
  },
};

