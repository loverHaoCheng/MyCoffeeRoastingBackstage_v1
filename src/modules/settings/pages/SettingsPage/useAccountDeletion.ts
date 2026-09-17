import { useCallback, useState } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

export const useAccountDeletion = (message: MessageInstance, modal: Omit<ModalStaticFunctions, 'warn'>) => {
  const queryClient = useQueryClient();
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = useCallback(() => {
    let remainingSeconds = 5;
    let countdownTimer: number | null = null;

    const clearCountdown = () => {
      if (countdownTimer != null) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
      }
    };

    const modalInstance = modal.confirm({
      cancelText: '取消',
      centered: true,
      content:
        '你的账号、烘焙业务数据、财务记录、库存设置和关联配置都会被永久删除，且无法恢复。请确认你已经完成导出或备份。',
      maskClosable: false,
      okButtonProps: {
        danger: true,
        disabled: true,
      },
      okText: `确认注销（${String(remainingSeconds)}s）`,
      onCancel: () => {
        clearCountdown();
      },
      onOk: async () => {
        clearCountdown();
        setIsDeletingAccount(true);

        try {
          await deleteAccount();
          queryClient.clear();
          void message.success('账号已注销，所有关联数据已删除。');
        } catch (error) {
          void message.error(getUserFacingErrorMessage(error, '账号注销失败，请稍后重试。'));
        } finally {
          setIsDeletingAccount(false);
        }
      },
      title: '确认注销账号？',
    });

    countdownTimer = window.setInterval(() => {
      remainingSeconds -= 1;

      if (remainingSeconds <= 0) {
        clearCountdown();
        modalInstance.update({
          okButtonProps: {
            danger: true,
            disabled: false,
          },
          okText: '确认注销',
        });
        return;
      }

      modalInstance.update({
        okButtonProps: {
          danger: true,
          disabled: true,
        },
        okText: `确认注销（${String(remainingSeconds)}s）`,
      });
    }, 1000);
  }, [deleteAccount, message, modal, queryClient]);

  return {
    isDeletingAccount,
    handleDeleteAccount,
  };
};
