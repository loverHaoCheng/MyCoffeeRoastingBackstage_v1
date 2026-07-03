import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';

import { refreshAllAppData } from '@/app/services/appDataRefresh.service';
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
  const hasStartedRef = useRef(false);
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  useEffect(() => {
    if (import.meta.env.MODE === 'test' || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const cancelSchedule = scheduleWhenIdle(() => {
      void (async () => {
        try {
          const result = await refreshAllAppData(queryClient);

          if (result.failed > 0) {
            void message.warning('部分数据刷新失败，将在稍后自动重试。');
            return;
          }

          if (result.success + result.uploaded + result.downloaded > 0) {
            void message.info('已在后台完成本地与云端数据同步。');
          }
        } catch (error) {
          void message.warning(getErrorMessage(error));
          return;
        }
      })();
    });

    return () => {
      cancelSchedule();
    };
  }, [message, queryClient]);

  return null;
}
