import { create } from 'zustand';

import { pocketBaseAuthService } from '@/modules/auth/services/pocketBaseAuth.service';
import { pocketBaseSessionService, type PocketBaseSession, type PocketBaseSessionUser } from '@/services/pocketBaseSession.service';
import { localStorageCleanupService } from '@/shared/services/localStorageCleanup.service';

import type { AuthCredentialsInput, RegisterInput } from '../types';

export type AuthStatus = 'authenticated' | 'unauthenticated';

interface AuthState {
  login: (input: AuthCredentialsInput) => Promise<PocketBaseSession>;
  logout: () => void;
  register: (input: RegisterInput) => Promise<PocketBaseSession>;
  session: PocketBaseSession | null;
  status: AuthStatus;
  user: PocketBaseSessionUser | null;
}

const loadInitialSession = (): PocketBaseSession | null => {
  const session = pocketBaseSessionService.load();

  if (session) {
    return session;
  }

  if (import.meta.env.MODE === 'test') {
    return {
      baseUrl: pocketBaseSessionService.getBaseUrl(),
      token: 'test-token',
      updatedAt: new Date().toISOString(),
      user: {
        email: 'tester@example.com',
        id: 'test-user',
      },
    };
  }

  return null;
};

const initialSession = loadInitialSession();

export const useAuthStore = create<AuthState>((set) => ({
  login: async (input) => {
    localStorageCleanupService.clearAppState();
    const session = await pocketBaseAuthService.login(input);

    set({
      session,
      status: 'authenticated',
      user: session.user,
    });

    return session;
  },
  logout: () => {
    localStorageCleanupService.clearAppState();
    pocketBaseAuthService.logout();
    set({
      session: null,
      status: 'unauthenticated',
      user: null,
    });
  },
  register: async (input) => {
    localStorageCleanupService.clearAppState();
    const session = await pocketBaseAuthService.register(input);

    set({
      session,
      status: 'authenticated',
      user: session.user,
    });

    return session;
  },
  session: initialSession,
  status: initialSession != null ? 'authenticated' : 'unauthenticated',
  user: initialSession?.user ?? null,
}));
