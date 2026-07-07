import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';

import { refreshAllAppData } from '@/app/services/appDataRefresh.service';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { AppError } from '@/shared/errors/AppError';

const scheduleWhenIdle = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(callback, {
      timeout: 1800,
    });

    return () => {
      window.cancelIdleCallback(idleId);
    };
  }

  const timeoutId = globalThis.setTimeout(callback, 900);

  return () => {
    globalThis.clearTimeout(timeoutId);
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return '本地与云端同步失败，请稍后重试。';
};

export function AppStartupSync() {
  const syncedUserIdRef = useRef<null | string>(null);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const userId = useAuthStore((state) => state.user?.id ?? null);

  useEffect(() => {
    if (!isAuthenticated) {
      syncedUserIdRef.current = null;
      return;
    }

    if (import.meta.env.MODE === 'test' || !userId || syncedUserIdRef.current === userId) {
      return;
    }

    syncedUserIdRef.current = userId;

    const cancelSchedule = scheduleWhenIdle(() => {
      void (async () => {
        try {
          const result = await refreshAllAppData(queryClient);

          if (result.failed > 0) {
            void message.warning('登录后同步未完全成功，部分数据稍后会继续重试。');
            return;
          }

          if (result.downloaded + result.uploaded + result.success > 0) {
            void message.info('登录后已完成本地与 PocketBase 数据同步。');
            return;
          }

          void message.info('登录后已校验当前数据，与 PocketBase 保持一致。');
        } catch (error) {
          syncedUserIdRef.current = null;
          void message.warning(getErrorMessage(error));
          return;
        }
      })();
    });

    return () => {
      cancelSchedule();
    };
  }, [isAuthenticated, message, queryClient, userId]);

  return null;
}
