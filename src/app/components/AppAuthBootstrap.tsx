import { useEffect } from 'react';

import { useAuthStore } from '@/modules/auth/store/useAuthStore';

export function AppAuthBootstrap() {
  const bootstrapSession = useAuthStore((state) => state.bootstrapSession);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  return null;
}
