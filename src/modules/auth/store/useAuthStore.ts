import { create } from 'zustand';

import { pocketBaseAuthService } from '@/modules/auth/services/pocketBaseAuth.service';
import {
  pocketBaseSessionService,
  type PocketBaseSession,
  type PocketBaseSessionUser,
} from '@/services/pocketBaseSession.service';
import { localStorageCleanupService } from '@/shared/services/localStorageCleanup.service';

import type { AuthCredentialsInput, RegisterInput, RegisterResult } from '../types';

export type AuthStatus = 'authenticated' | 'hydrating' | 'unauthenticated';

interface AuthState {
  bootstrapSession: () => Promise<void>;
  hasHydrated: boolean;
  login: (input: AuthCredentialsInput) => Promise<PocketBaseSession>;
  logout: () => Promise<void>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  session: PocketBaseSession | null;
  status: AuthStatus;
  user: PocketBaseSessionUser | null;
}

let bootstrapSessionPromise: Promise<void> | null = null;

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
const initialHasHydrated = initialSession != null || import.meta.env.MODE === 'test';

export const useAuthStore = create<AuthState>((set, get) => ({
  bootstrapSession: async () => {
    if (get().hasHydrated) {
      return;
    }

    if (bootstrapSessionPromise != null) {
      return bootstrapSessionPromise;
    }

    bootstrapSessionPromise = (async () => {
      set({
        hasHydrated: false,
        status: 'hydrating',
      });

      try {
        const session = await pocketBaseAuthService.restoreSession();

        if (session) {
          set({
            hasHydrated: true,
            session,
            status: 'authenticated',
            user: session.user,
          });
          return;
        }

        set({
          hasHydrated: true,
          session: null,
          status: 'unauthenticated',
          user: null,
        });
      } catch {
        set({
          hasHydrated: true,
          session: null,
          status: 'unauthenticated',
          user: null,
        });
      } finally {
        bootstrapSessionPromise = null;
      }
    })();

    return bootstrapSessionPromise;
  },
  hasHydrated: initialHasHydrated,
  login: async (input) => {
    localStorageCleanupService.clearAppState();
    const session = await pocketBaseAuthService.login(input);

    set({
      hasHydrated: true,
      session,
      status: 'authenticated',
      user: session.user,
    });

    return session;
  },
  logout: async () => {
    localStorageCleanupService.clearAppState();
    await pocketBaseAuthService.logout();
    set({
      hasHydrated: true,
      session: null,
      status: 'unauthenticated',
      user: null,
    });
  },
  register: async (input) => {
    localStorageCleanupService.clearAppState();
    const result = await pocketBaseAuthService.register(input);

    set({
      hasHydrated: true,
      session: null,
      status: 'unauthenticated',
      user: null,
    });

    return result;
  },
  session: initialSession,
  status: initialSession != null ? 'authenticated' : 'hydrating',
  user: initialSession?.user ?? null,
}));
