import { useCallback, useState } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';

import { useDeleteRoastPlan } from '@/modules/roast/hooks';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import type { RoastPlan } from '@/types/domain';

export const usePlanDeletion = (
  message: MessageInstance,
  modal: Omit<ModalStaticFunctions, 'warn'>,
  onDeleteSuccess: () => void,
) => {
  const deleteMutation = useDeleteRoastPlan();

  const handleDelete = useCallback((plan: RoastPlan) => {
    modal.confirm({
      centered: true,
      content: `确定要删除「${plan.name}」吗？此操作不可撤销。`,
      okButtonProps: { danger: true },
      okText: '删除',
      title: '确认删除',
      onOk() {
        void deleteMutation
          .mutateAsync(plan.id)
          .then(() => {
            onDeleteSuccess();
          })
          .catch((error: unknown) => {
            void message.error(
              getUserFacingErrorMessage(error, '删除失败，未能同步到 PocketBase，请检查网络或服务状态。'),
            );
          });
      },
    });
  }, [deleteMutation, message, modal, onDeleteSuccess]);

  return { handleDelete };
};
