import { useCallback } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';
import { useQueryClient } from '@tanstack/react-query';

import { roastPlanQueryKeys } from '@/modules/roast/hooks';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import type { RoastPlan } from '@/types/domain';
import type { RoastPlanJsonInput } from '@/modules/roast/types';
import { sortPlansByUpdatedAt } from './planUtils';

export const usePlanCreation = (
  message: MessageInstance,
  onCreateSuccess: () => void,
) => {
  const queryClient = useQueryClient();

  const handleCreateManual = useCallback((input: RoastPlanJsonInput) => {
    onCreateSuccess();
    const backupId = submissionBackupService.save('create', input, 'roastPlan');
    const optimisticPlan = roastPlanService.createOptimisticPlan(input);

    queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), (current = []) => {
      return sortPlansByUpdatedAt([
        optimisticPlan,
        ...current.filter((plan) => String(plan.id) !== String(optimisticPlan.id)),
      ]);
    });

    const createTask = (async () => {
      try {
        const response = await roastPlanService.createPlan(input);
        const nextPlans = roastPlanService.finalizeOptimisticPlan(optimisticPlan.id, response.data);

        queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), nextPlans);
        submissionBackupService.clear(backupId);
      } catch (error: unknown) {
        const nextPlans = roastPlanService.rollbackOptimisticPlan(optimisticPlan.id);
        queryClient.setQueryData<RoastPlan[]>(roastPlanQueryKeys.list(), nextPlans);
        void message.error(getUserFacingErrorMessage(error, '烘焙计划同步失败，已回滚本次新建，请检查后重试。'));
      }
    })();

    void createTask;
  }, [message, onCreateSuccess, queryClient]);

  return { handleCreateManual };
};
