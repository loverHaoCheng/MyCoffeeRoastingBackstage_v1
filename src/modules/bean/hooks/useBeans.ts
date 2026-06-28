import { useQuery } from '@tanstack/react-query';

import { beanService } from '@/modules/bean/services';

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
  });
}
