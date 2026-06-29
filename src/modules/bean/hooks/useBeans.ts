import { useQuery } from '@tanstack/react-query';

import { beanService } from '@/modules/bean/services';
import { AppError } from '@/shared/errors/AppError';

export const beanQueryKeys = {
  all: ['beans'] as const,
  list: () => [...beanQueryKeys.all, 'list'] as const,
};

export function useBeans() {
  return useQuery({
    queryKey: beanQueryKeys.list(),
    queryFn: async () => {
      const response = await beanService.listBeans();

      return response.data;
    },
    retry: (failureCount, error) => {
      if (error instanceof AppError) {
        if (error.code === 'AUTH' || error.code === 'CONFIG' || error.code === 'DATA') {
          return false;
        }
      }

      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}
