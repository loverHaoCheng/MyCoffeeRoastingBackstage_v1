import type { IncomingMessage } from 'node:http';

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_REQUESTS = 8;
const AUTH_RATE_LIMIT_MAX_ENTRIES = 10_000;

interface RateLimitEntry {
  resetAt: number;
  requestCount: number;
}

const entries = new Map<string, RateLimitEntry>();

const pruneExpiredEntries = (now: number): void => {
  entries.forEach((entry, key) => {
    if (entry.resetAt <= now) {
      entries.delete(key);
    }
  });

  while (entries.size >= AUTH_RATE_LIMIT_MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value;

    if (oldestKey == null) {
      return;
    }

    entries.delete(oldestKey);
  }
};

const isLoopbackAddress = (value: string | undefined): boolean => {
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
};

const getClientAddress = (request: IncomingMessage): string => {
  const realIp = request.headers['x-real-ip'];

  if (isLoopbackAddress(request.socket.remoteAddress) && typeof realIp === 'string') {
    const normalized = realIp.trim();

    if (normalized) {
      return normalized;
    }
  }

  return request.socket.remoteAddress ?? 'unknown';
};

const consumeRateLimitKey = (key: string): boolean => {
  const now = Date.now();
  pruneExpiredEntries(now);
  const current = entries.get(key);

  if (!current || current.resetAt <= now) {
    entries.set(key, {
      requestCount: 1,
      resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  current.requestCount += 1;
  return current.requestCount > AUTH_RATE_LIMIT_MAX_REQUESTS;
};

export const isAuthRateLimited = (request: IncomingMessage, route: string): boolean => {
  return consumeRateLimitKey(`${route}:${getClientAddress(request)}`);
};

/**
 * 账号维度限流：与 IP 维度互补。
 *
 * IP 维度的键在反向代理后依赖 `x-real-ip` 请求头，若代理层未强制
 * 覆盖该头，攻击者可用伪造 IP 绕过限流；账号维度按登录标识计数，
 * 与请求来源无关，保证针对单一账号的暴力破解始终受限。
 */
export const isAuthIdentityRateLimited = (identity: string, route: string): boolean => {
  const normalized = identity.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return consumeRateLimitKey(`identity:${route}:${normalized}`);
};

export const clearAuthRateLimitForTests = (): void => {
  entries.clear();
};
