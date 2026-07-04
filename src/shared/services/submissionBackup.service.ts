type SubmissionBackupOperation = 'create' | 'update';

type SubmissionBackupScope = 'bean' | 'roastBatch' | 'roastPlan';

const submissionBackupStorageKey = 'coffee-roasting-backstage:submission-backups';

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export const submissionBackupService = {
  save(operation: SubmissionBackupOperation, payload: unknown, scope: SubmissionBackupScope): void {
    if (!canUseStorage()) {
      return;
    }

    void { operation, payload, scope };
    window.localStorage.removeItem(submissionBackupStorageKey);
  },
};
