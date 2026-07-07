import { logger } from '@/shared/logger/logger';

type SubmissionBackupOperation = 'create' | 'update';
type SubmissionBackupScope = 'bean' | 'roastBatch' | 'roastPlan';

export const submissionBackupService = {
  save(operation: SubmissionBackupOperation, payload: unknown, scope: SubmissionBackupScope): void {
    logger.debug('submission backup skipped until indexed db draft cache is wired', {
      operation,
      payloadType: typeof payload,
      scope,
    });
  },
};
