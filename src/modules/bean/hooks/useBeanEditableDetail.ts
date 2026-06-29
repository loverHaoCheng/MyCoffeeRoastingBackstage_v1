import { useQuery } from '@tanstack/react-query';

import { beanService } from '@/modules/bean/services';

export const beanEditableDetailQueryKeys = {
  all: ['beans', 'editable-detail'] as const,
  detail: (beanId: number | string) => [...beanEditableDetailQueryKeys.all, String(beanId)] as const,
};

export function useBeanEditableDetail(beanId: null | number | string) {
  return useQuery({
    enabled: beanId != null,
    queryKey: beanId == null ? beanEditableDetailQueryKeys.all : beanEditableDetailQueryKeys.detail(beanId),
    queryFn: async () => {
      if (beanId == null) {
        throw new Error('缺少生豆 ID');
      }

      const response = await beanService.getEditableBean(beanId);

      return response.data;
    },
  });
}
