import { AppError } from '@/shared/errors/AppError';

const GENERIC_FETCH_FAILURE_PATTERNS = [/failed to fetch/i, /load failed/i, /networkerror/i];

const isGenericFetchFailure = (message: string): boolean => {
  return GENERIC_FETCH_FAILURE_PATTERNS.some((pattern) => pattern.test(message));
};

const getUnknownErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '主业务数据服务响应超时，请检查当前网络后重试；持续异常请联系管理员。';
  }

  if (error instanceof Error) {
    const message = error.message.trim();

    if (!message) {
      return fallbackMessage;
    }

    if (isGenericFetchFailure(message)) {
      return '主业务数据服务暂不可用，请检查当前网络后重试；持续异常请联系管理员。';
    }

    return message;
  }

  return fallbackMessage;
};

export const getUserFacingErrorMessage = (
  error: unknown,
  fallbackMessage = '请求失败，请稍后重试。',
): string => {
  if (!(error instanceof AppError)) {
    return getUnknownErrorMessage(error, fallbackMessage);
  }

  switch (error.code) {
    case 'CONFIG':
      return '主业务数据服务配置异常，请刷新页面后重试；持续异常请联系管理员。';
    case 'AUTH':
      if (error.status === 401) {
        return '登录失败，邮箱或密码不正确，请重新输入。';
      }

      if (error.status === 403) {
        return '当前账号没有权限访问该数据，请确认账号权限或重新登录。';
      }

      return error.message || 'PocketBase 鉴权失败，请重新登录后再试。';
    case 'RATE_LIMIT':
      return '请求过于频繁，请稍后重试。';
    case 'TIMEOUT':
      return '主业务数据服务响应超时，请检查当前网络后重试；持续异常请联系管理员。';
    case 'DATA':
      return error.message || '数据库返回的数据结构与前端预期不一致，请检查表结构、视图或字段映射。';
    case 'NETWORK':
      return error.message || '主业务数据服务暂不可用，请检查当前网络后重试；持续异常请联系管理员。';
    case 'HTTP':
      return error.message || fallbackMessage;
    case 'BUSINESS':
      return error.message || fallbackMessage;
    default:
      return error.message || fallbackMessage;
  }
};
