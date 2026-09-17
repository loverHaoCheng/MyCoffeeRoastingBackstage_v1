import App from 'antd/es/app';
import type { RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import type { UseMutationResult } from '@tanstack/react-query';

interface ValidateAndSubmitParams {
  draft: RoastBatchUpdateInput;
  batchId: string;
  maximumSoldUnitCount: null | number;
  onClose: () => void;
  updateBatchMutation: UseMutationResult<unknown, Error, { batchId: string; input: RoastBatchUpdateInput }>;
}

export const useValidateAndSubmit = () => {
  const { message } = App.useApp();

  const validateAndSubmit = ({
    draft,
    batchId,
    maximumSoldUnitCount,
    onClose,
    updateBatchMutation,
  }: ValidateAndSubmitParams) => {
    if (!draft.roastDate) {
      void message.warning('请选择烘焙日期。');
      return;
    }

    if (!draft.greenBeanId) {
      void message.warning('请选择生豆。');
      return;
    }

    if ((draft.inputWeightGrams ?? 0) <= 0) {
      void message.warning('请输入有效的入豆量。');
      return;
    }

    if ((draft.outputWeightGrams ?? 0) < 0) {
      void message.warning('请输入有效的出豆量。');
      return;
    }

    if (
      draft.salesMode === 'sale' &&
      maximumSoldUnitCount != null &&
      (draft.soldUnitCount ?? 0) > maximumSoldUnitCount
    ) {
      void message.warning(`已售份数不能超过本锅最多可售的 ${String(maximumSoldUnitCount)} 份。`);
      return;
    }

    const updateInput: RoastBatchUpdateInput = {
      beanAgtronColor: draft.beanAgtronColor,
      developmentRatio: draft.developmentRatio,
      firstCrackTime: draft.firstCrackTime,
      groundAgtronColor: draft.groundAgtronColor,
      greenBeanId: draft.greenBeanId,
      greenBeanName: draft.greenBeanName,
      inputWeightGrams: draft.inputWeightGrams,
      notes: draft.notes,
      outputWeightGrams: draft.outputWeightGrams,
      roastDate: draft.roastDate,
      roastLevel: draft.roastLevel,
      roastLevelSource: draft.roastLevelSource,
      roastPlanId: draft.roastPlanId,
      roastPlanName: draft.roastPlanName,
      roastedBeanName: draft.roastedBeanName,
      salesMode: draft.salesMode,
      soldUnitCount: draft.soldUnitCount,
      status: draft.status,
      totalRoastTime: draft.totalRoastTime,
    };

    onClose();
    const backupId = submissionBackupService.save('update', { batchId, input: updateInput }, 'roastBatch');

    const updateTask = updateBatchMutation
      .mutateAsync({ batchId, input: updateInput })
      .then(() => {
        submissionBackupService.clear(backupId);
      })
      .catch((error: unknown) => {
        void message.error(getUserFacingErrorMessage(error, '烘焙记录同步失败，本次修改未保存，请保留编辑内容并重试。'));
      });

    void updateTask;
  };

  return { validateAndSubmit };
};
