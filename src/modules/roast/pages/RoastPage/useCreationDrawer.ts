import { useCallback, useState } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';

import { defaultRoastPlanFormValues } from '@/modules/roast/constants';
import { parseRoastPlanJsonDraft } from '@/modules/roast/services';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import type { RoastPlanJsonInput } from '@/modules/roast/types';
import type { RoastPlan } from '@/types/domain';
import type { RoastingMachine } from '@/modules/roast/types/roasterMachine';
import { sortPlansByUpdatedAt } from './planUtils';

export type CreationMode = 'json' | 'manual';

export const useCreationDrawer = (
  message: MessageInstance,
  plans: RoastPlan[],
  roastingMachines: RoastingMachine[],
) => {
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<CreationMode>('manual');
  const [creationInitialValues, setCreationInitialValues] = useState<RoastPlanJsonInput | undefined>();
  const [creationResetSignal, setCreationResetSignal] = useState(0);

  const resetCreationDraft = useCallback(() => {
    const latestBeanPlan = sortPlansByUpdatedAt(plans).find((plan) => {
      return String(plan.beanId) !== 'generic' && plan.beanName.trim().length > 0;
    });
    const latestAssociatedMachineId = latestBeanPlan?.roasterMachineId;
    const defaultMachine = roastingMachines.find((machine) => machine.id === latestAssociatedMachineId)
      ?? roastingMachines[0];

    setCreationMode('manual');
    setCreationInitialValues({
      ...defaultRoastPlanFormValues,
      ...(latestBeanPlan
        ? {
            beanId: latestBeanPlan.beanId,
            beanName: latestBeanPlan.beanName,
          }
        : {}),
      roasterMachineId: defaultMachine?.id,
      roasterModel: defaultMachine?.displayName ?? '',
    });
    setCreationResetSignal((current) => current + 1);
  }, [plans, roastingMachines]);

  const handleFillFormFromJson = useCallback((jsonText: string) => {
    try {
      const nextInitialValues = parseRoastPlanJsonDraft(
        jsonText,
        creationInitialValues ?? defaultRoastPlanFormValues,
      );

      submissionBackupService.save('create', { input: nextInitialValues, jsonText }, 'roastPlan');
      setCreationInitialValues(nextInitialValues);
      setCreationMode('manual');
      setCreationDrawerOpen(true);
      void message.success('JSON 已回填到创建表单，可继续补充和修改。');
    } catch (error: unknown) {
      void message.error(getUserFacingErrorMessage(error, 'JSON 解析失败，请检查内容后重试。'));
    }
  }, [creationInitialValues, message]);

  const handleOpenCreationMode = useCallback((mode: CreationMode) => {
    resetCreationDraft();
    setCreationMode(mode);
    setCreationDrawerOpen(true);
  }, [resetCreationDraft]);

  const closeCreationDrawer = useCallback(() => {
    setCreationDrawerOpen(false);
    setCreationMode('manual');
  }, []);

  return {
    creationDrawerOpen,
    creationMode,
    creationInitialValues,
    creationResetSignal,
    resetCreationDraft,
    handleFillFormFromJson,
    handleOpenCreationMode,
    closeCreationDrawer,
  };
};
