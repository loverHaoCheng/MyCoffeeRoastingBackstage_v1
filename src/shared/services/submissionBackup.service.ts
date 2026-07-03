type SubmissionBackupOperation = 'create' | 'update';

type SubmissionBackupScope = 'bean' | 'roastBatch' | 'roastPlan';

const submissionBackupStorageKey = 'coffee-roasting-backstage:submission-backups';

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export const submissionBackupService = {
  save(_operation: SubmissionBackupOperation, _payload: unknown, _scope: SubmissionBackupScope): void {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(submissionBackupStorageKey);
  },
};
