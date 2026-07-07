import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useRef, useState } from 'react';

import type { AppDataRefreshResult } from '@/app/services/appDataRefresh.service';
import { refreshQuickAppData } from '@/app/services/appDataRefresh.service';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

export interface QuickRefreshFeedback {
  status: 'success' | 'warning';
  text: string;
}

interface QuickRefreshOptions {
  onError?: (message: string) => void;
  onSuccess?: (feedback: QuickRefreshFeedback, result: AppDataRefreshResult) => void;
  silent?: boolean;
}

export const getQuickRefreshFeedback = (result: AppDataRefreshResult): QuickRefreshFeedback => {
  if (result.failed > 0) {
    return {
      status: 'warning',
      text: '部分数据刷新失败，将在稍后自动重试',
    };
  }

  return {
    status: 'success',
    text:
      result.success > 0
        ? '快速刷新完成，待处理操作已同步'
        : '快速刷新完成，已完成当前数据对比',
  };
};

export function useQuickRefreshAction() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);

  const refresh = async (options: QuickRefreshOptions = {}): Promise<AppDataRefreshResult | null> => {
    if (isRefreshingRef.current) {
      return null;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      const result = await refreshQuickAppData(queryClient);
      const feedback = getQuickRefreshFeedback(result);

      options.onSuccess?.(feedback, result);

      if (!options.silent) {
        if (feedback.status === 'warning') {
          void message.warning(feedback.text);
        } else {
          void message.success(feedback.text);
        }
      }

      return result;
    } catch (error) {
      const errorMessage = getUserFacingErrorMessage(error, '刷新失败，请稍后重试。');

      options.onError?.(errorMessage);

      if (!options.silent) {
        void message.error(errorMessage);
      }

      return null;
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  };

  return {
    isRefreshing,
    refresh,
  };
}
