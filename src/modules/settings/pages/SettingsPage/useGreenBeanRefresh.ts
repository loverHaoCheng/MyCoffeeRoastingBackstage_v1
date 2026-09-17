import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { beanEditableDetailQueryKeys } from '@/modules/bean/hooks/useBeanEditableDetail';
import { beanQueryKeys } from '@/modules/bean/hooks/useBeans';
import { roastBatchQueryKeys, roastPlanQueryKeys } from '@/modules/roast/hooks';

export const useGreenBeanRefresh = () => {
  const queryClient = useQueryClient();
  const lastGreenBeanRefreshSignatureRef = useRef('');

  const refreshGreenBeanDependencies = useCallback(
    (connectionSignature: string) => {
      if (!connectionSignature || lastGreenBeanRefreshSignatureRef.current === connectionSignature) {
        return;
      }

      lastGreenBeanRefreshSignatureRef.current = connectionSignature;
      queryClient.removeQueries({ queryKey: beanQueryKeys.all });
      queryClient.removeQueries({ queryKey: beanEditableDetailQueryKeys.all });
      queryClient.removeQueries({ queryKey: roastPlanQueryKeys.all });
      queryClient.removeQueries({ queryKey: roastBatchQueryKeys.all });
    },
    [queryClient],
  );

  return { refreshGreenBeanDependencies };
};
