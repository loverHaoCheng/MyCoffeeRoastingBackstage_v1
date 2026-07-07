import { useAuthStore } from '@/modules/auth/store/useAuthStore';

export function useAuth() {
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const register = useAuthStore((state) => state.register);
  const session = useAuthStore((state) => state.session);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  return {
    login,
    logout,
    register,
    session,
    status,
    user,
    isAuthenticated: status === 'authenticated',
  };
}

