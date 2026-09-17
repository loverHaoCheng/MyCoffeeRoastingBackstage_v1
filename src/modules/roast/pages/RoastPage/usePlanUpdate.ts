import { useCallback } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';

import { useUpdateRoastPlan } from '@/modules/roast/hooks';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import type { RoastPlan } from '@/types/domain';
import type { RoastPlanJsonInput } from '@/modules/roast/types';

export const usePlanUpdate = (message: MessageInstance) => {
  const updateMutation = useUpdateRoastPlan();

  const handleUpdate = useCallback((planId: RoastPlan['id'], input: RoastPlanJsonInput) => {
    const backupId = submissionBackupService.save('update', { input, planId }, 'roastPlan');

    const updateTask = (async () => {
      try {
        await updateMutation.mutateAsync({ planId, input });
        submissionBackupService.clear(backupId);
      } catch (error: unknown) {
        void message.error(getUserFacingErrorMessage(error, '烘焙计划同步失败，本次修改未保存，请保留编辑内容并重试。'));
      }
    })();

    void updateTask;
  }, [message, updateMutation]);

  return { handleUpdate };
};
