import { useAuthStore } from '@/modules/auth/store/useAuthStore';

export function useAuth() {
  const bootstrapSession = useAuthStore((state) => state.bootstrapSession);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const register = useAuthStore((state) => state.register);
  const session = useAuthStore((state) => state.session);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  return {
    bootstrapSession,
    hasHydrated,
    login,
    logout,
    register,
    session,
    status,
    user,
    isAuthenticated: status === 'authenticated',
    isHydrating: status === 'hydrating',
  };
}
