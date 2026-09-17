import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';
import { useQueryClient } from '@tanstack/react-query';

import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import {
  userDataBackupService,
  type UserDataBackupFile,
  type UserDataBackupImportResult,
  type UserDataBackupImportStrategy,
} from '@/modules/settings/services/userDataBackup.service';
import { getBackupImportSuccessMessage } from './backupMessages';

export const useBackupManager = (message: MessageInstance, modal: Omit<ModalStaticFunctions, 'warn'>) => {
  const queryClient = useQueryClient();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<UserDataBackupFile | null>(null);
  const [backupImportStrategy, setBackupImportStrategy] = useState<UserDataBackupImportStrategy>('merge');
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadBackup = useCallback(async () => {
    setIsBackingUp(true);

    try {
      const backup = await userDataBackupService.createBackup();

      userDataBackupService.downloadBackup(backup);
      void message.success('备份文件已生成。');
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '备份失败，请检查登录状态和网络后重试。'));
    } finally {
      setIsBackingUp(false);
    }
  }, [message]);

  const handleImportBackup = useCallback(async (
    backup: UserDataBackupFile,
    strategy: UserDataBackupImportStrategy,
  ) => {
    setIsImportingBackup(true);

    try {
      const result = await userDataBackupService.importBackup(backup, { strategy });

      queryClient.clear();
      setPendingBackup(null);
      void message.success(`备份上传完成，${getBackupImportSuccessMessage(result)}。`);
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '备份上传失败，请确认文件和当前账号权限。'));
    } finally {
      setIsImportingBackup(false);
    }
  }, [message, queryClient]);

  const handleBackupFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    void userDataBackupService
      .readBackupFile(file)
      .then((backup) => {
        if (userDataBackupService.getImportMode(backup) === 'same-account') {
          setBackupImportStrategy('merge');
          setPendingBackup(backup);
          return;
        }

        modal.confirm({
          cancelText: '取消',
          centered: true,
          content: '跨账号备份会为所有记录重新分配 ID 后新增到当前账号。生豆编号或名称相同也会保留各自数据，不会删除当前账号已有数据。',
          okText: '合并导入备份',
          onOk: async () => {
            await handleImportBackup(backup, 'merge');
          },
          title: '上传备份到当前账号？',
        });
      })
      .catch((error: unknown) => {
        void message.error(getUserFacingErrorMessage(error, '备份文件读取失败，请选择 EasyBake 备份 JSON。'));
      });
  }, [handleImportBackup, message, modal]);

  const confirmPendingBackup = useCallback(() => {
    if (pendingBackup) {
      void handleImportBackup(pendingBackup, backupImportStrategy);
    }
  }, [backupImportStrategy, handleImportBackup, pendingBackup]);

  return {
    isBackingUp,
    isImportingBackup,
    pendingBackup,
    backupImportStrategy,
    backupFileInputRef,
    handleDownloadBackup,
    handleBackupFileChange,
    setBackupImportStrategy,
    setPendingBackup,
    confirmPendingBackup,
  };
};
