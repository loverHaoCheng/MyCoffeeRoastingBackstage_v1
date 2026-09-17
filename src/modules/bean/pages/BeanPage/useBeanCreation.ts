import { useCallback } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';
import { useQueryClient } from '@tanstack/react-query';

import { beanQueryKeys } from '@/modules/bean/hooks/useBeans';
import { beanService } from '@/modules/bean/services';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import type { Bean } from '@/types/domain';
import type { GreenBeanCreateInput } from '@/modules/bean/types';
import { sortBeansByCreatedAt } from './beanUtils';

export const useBeanCreation = (message: MessageInstance) => {
  const queryClient = useQueryClient();

  const handleCreateBean = useCallback((input: GreenBeanCreateInput) => {
    const backupId = submissionBackupService.save('create', input, 'bean');
    const optimisticBean = beanService.createOptimisticBean(input);

    queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), (current = []) => {
      return sortBeansByCreatedAt([
        optimisticBean,
        ...current.filter((bean) => String(bean.id) !== String(optimisticBean.id)),
      ]);
    });

    const createTask = (async () => {
      try {
        const response = await beanService.createRemoteBean(input);
        const nextBeans = beanService.finalizeOptimisticBean(String(optimisticBean.id), response.data);

        queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), nextBeans);
        submissionBackupService.clear(backupId);
      } catch (error) {
        const nextBeans = beanService.rollbackOptimisticBean(String(optimisticBean.id));
        queryClient.setQueryData<Bean[]>(beanQueryKeys.list(), nextBeans);
        void message.error(getUserFacingErrorMessage(error, '生豆同步失败，已回滚本次新建，请检查后重试。'));
      }
    })();

    void createTask;
  }, [message, queryClient]);

  return { handleCreateBean };
};
