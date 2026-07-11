export interface PocketBaseSessionUser {
  email: string;
  id: string;
  name?: string;
  verified?: boolean;
  username?: string;
}

export interface PocketBaseSession {
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
    name: typeof record.name === 'string' && record.name.trim().length > 0 ? record.name.trim() : undefined,
    verified: typeof record.verified === 'boolean' ? record.verified : undefined,
    username: typeof record.username === 'string' ? record.username : undefined,
  };
};

const normalizeSession = (value: unknown): PocketBaseSession | null => {
  if (typeof value !== 'object' || value == null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString();
  const user = normalizeSessionUser(record.user);

  if (!user) {
    return null;
  }

  return {
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
      updatedAt: new Date().toISOString(),
    };

    currentSession = nextSession;

    return nextSession;
  },
  getUser(): PocketBaseSessionUser | null {
    return this.load()?.user ?? null;
  },
};
