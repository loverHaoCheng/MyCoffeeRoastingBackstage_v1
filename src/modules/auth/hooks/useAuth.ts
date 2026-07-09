import { pocketBaseAuthService } from '@/modules/auth/services/pocketBaseAuth.service';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';

export function useAuth() {
  const bootstrapSession = useAuthStore((state) => state.bootstrapSession);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const register = useAuthStore((state) => state.register);
  const session = useAuthStore((state) => state.session);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  return {
    bootstrapSession,
    deleteAccount,
    hasHydrated,
    login,
    logout,
    requestPasswordReset: (email: string) => pocketBaseAuthService.requestPasswordReset(email),
    requestVerification: (email: string) => pocketBaseAuthService.requestVerification(email),
    register,
    session,
    status,
    user,
    isAuthenticated: status === 'authenticated',
    isHydrating: status === 'hydrating',
  };
}
