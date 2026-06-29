import { AppError } from '@/shared/errors/AppError';

export const getUserFacingErrorMessage = (error: unknown): string => {
  if (!(error instanceof AppError)) {
    return '请求失败，请稍后重试。';
  }

  switch (error.code) {
    case 'CONFIG':
      return '数据库连接配置不完整，请先在设置页填写正确的 Supabase Project URL 和 Publishable Key。';
    case 'AUTH':
      return 'Supabase 鉴权失败，请检查 Publishable Key 是否正确，并确认匿名访问策略已开放。';
    case 'RATE_LIMIT':
      return '请求过于频繁，已被 Supabase 限流，请稍后重试。';
    case 'TIMEOUT':
      return '请求超时，请检查网络、Supabase 服务状态或稍后重试。';
    case 'DATA':
      return '数据库返回的数据结构与前端预期不一致，请检查表结构、视图或字段映射。';
    case 'NETWORK':
      return '网络连接异常，请检查当前网络或 Supabase 服务可达性。';
    case 'HTTP':
      return error.message || '服务端请求失败。';
    case 'BUSINESS':
      return error.message || '业务处理失败。';
    default:
      return error.message || '发生未知错误，请稍后重试。';
  }
};
