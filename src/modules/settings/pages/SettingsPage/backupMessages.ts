import type { UserDataBackupImportResult } from '@/modules/settings/services/userDataBackup.service';

export const getBackupImportSuccessMessage = (result: UserDataBackupImportResult): string => {
  return [
    `新增 ${String(result.imported)} 条`,
    `更新 ${String(result.updated)} 条`,
    `删除 ${String(result.deleted)} 条`,
    `跳过 ${String(result.skipped)} 条`,
  ].join('，');
};
