import { AppError } from '@/shared/errors/AppError';

export const isMissingRemoteResourceError = (error: unknown): boolean => {
  if (!(error instanceof AppError)) {
    return false;
  }

  const cause = error.cause;
  const payload = typeof cause === 'object' && cause != null ? (cause as { code?: string; message?: string }) : null;
  const message = payload?.message ?? error.message;

  return error.status === 404 || payload?.code?.startsWith('PGRST') === true || message.includes('不存在');
};

export const isIncomeCollectionNotReadyError = (error: unknown): boolean => {
  return isMissingRemoteResourceError(error) || (error instanceof AppError && error.status === 403);
};

export const createMissingIncomeCollectionError = (): AppError => {
  return new AppError(
    '收入记录保存失败：远端 finance_income_records 集合或主业务 BFF 白名单尚未就绪，请同步最新服务端配置。',
    {
      code: 'BUSINESS',
    },
  );
};
