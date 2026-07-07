import { normalizePocketBaseBaseUrl, resolvePocketBaseBaseUrl } from '@/services/pocketBaseConfig';

const pocketBaseSessionStorageKey = 'coffee-roasting-backstage:pocketbase-session';

export interface PocketBaseSessionUser {
  email: string;
  id: string;
  verified?: boolean;
  username?: string;
}

export interface PocketBaseSession {
  baseUrl: string;
  token: string;
  updatedAt: string;
  user: PocketBaseSessionUser;
}

let currentSession: PocketBaseSession | null = null;

const normalizeSessionUser = (value: unknown): PocketBaseSessionUser | null => {
  if (typeof value !== 'object' || value == null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const email = typeof record.email === 'string' ? record.email.trim() : '';

  if (!id || !email) {
    return null;
  }

  return {
    email,
    id,
    verified: typeof record.verified === 'boolean' ? record.verified : undefined,
    username: typeof record.username === 'string' ? record.username : undefined,
  };
};

const normalizeSession = (value: unknown): PocketBaseSession | null => {
  if (typeof value !== 'object' || value == null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const token = typeof record.token === 'string' ? record.token.trim() : '';
  const baseUrl = normalizePocketBaseBaseUrl(
    typeof record.baseUrl === 'string' ? record.baseUrl : resolvePocketBaseBaseUrl(),
  );
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString();
  const user = normalizeSessionUser(record.user);

  if (!token || !user) {
    return null;
  }

  return {
    baseUrl,
    token,
    updatedAt,
    user,
  };
};

export const pocketBaseSessionService = {
  clear(): void {
    currentSession = null;
  },
  load(): PocketBaseSession | null {
    return currentSession == null ? null : normalizeSession(currentSession);
  },
  save(session: Omit<PocketBaseSession, 'updatedAt'>): PocketBaseSession {
    const nextSession: PocketBaseSession = {
      ...session,
      baseUrl: normalizePocketBaseBaseUrl(session.baseUrl),
      updatedAt: new Date().toISOString(),
    };

    currentSession = nextSession;

    return nextSession;
  },
  getBaseUrl(): string {
    return this.load()?.baseUrl ?? resolvePocketBaseBaseUrl();
  },
  getToken(): string {
    return this.load()?.token ?? '';
  },
  getUser(): PocketBaseSessionUser | null {
    return this.load()?.user ?? null;
  },
  getStorageKey(): string {
    return pocketBaseSessionStorageKey;
  },
};
