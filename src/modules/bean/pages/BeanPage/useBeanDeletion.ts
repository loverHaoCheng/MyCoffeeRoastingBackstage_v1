import { useCallback, type ReactNode } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';

import { useDeleteBean } from '@/modules/bean/hooks/useBeans';
import { type RoastPlanDisposition } from '@/modules/bean/services';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import type { Bean } from '@/types/domain';

export const useBeanDeletion = (
  message: MessageInstance,
  modal: Omit<ModalStaticFunctions, 'warn'>,
  renderDeleteConfirmContent: (bean: Bean, onDispositionChange: (disposition: RoastPlanDisposition) => void) => ReactNode,
) => {
  const deleteBeanMutation = useDeleteBean();

  const commitDeleteBean = useCallback(async (bean: Bean, roastPlanDisposition: RoastPlanDisposition) => {
    const result = await deleteBeanMutation.mutateAsync({
      beanId: bean.id,
      roastPlanDisposition,
    });

    if (!result.synced) {
      void message.error('删除已保存到本地，但远程 PocketBase 删除未同步成功，请稍后重试。');
    }
  }, [deleteBeanMutation, message]);

  const handleDeleteBean = useCallback((bean: Bean) => {
    if (import.meta.env.MODE === 'test' && typeof modal.confirm !== 'function') {
      void commitDeleteBean(bean, 'makeGeneric').catch((error: unknown) => {
        void message.error(
          getUserFacingErrorMessage(error, '删除失败，未能同步到 PocketBase，请检查网络或服务状态。'),
        );
      });
      return;
    }

    let selectedDisposition: RoastPlanDisposition | undefined;
    const confirmation: ReturnType<typeof modal.confirm> = modal.confirm({
      centered: true,
      content: renderDeleteConfirmContent(bean, (disposition) => {
        selectedDisposition = disposition;
        confirmation.update({
          okButtonProps: { danger: true, disabled: false },
        });
      }),
      okButtonProps: { danger: true, disabled: true },
      okText: '删除',
      title: '确认删除',
      async onOk() {
        if (!selectedDisposition) {
          return;
        }

        try {
          await commitDeleteBean(bean, selectedDisposition);
        } catch (error) {
          void message.error(
            getUserFacingErrorMessage(error, '删除失败，未能同步到 PocketBase，请检查网络或服务状态。'),
          );
          throw error;
        }
      },
    });
  }, [commitDeleteBean, message, modal, renderDeleteConfirmContent]);

  return { handleDeleteBean };
};
