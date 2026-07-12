import { describe, expect, it } from 'vitest';

import { AppError } from '@/shared/errors/AppError';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

describe('getUserFacingErrorMessage', () => {
  it('translates browser fetch failures into a specific connection message', () => {
    expect(getUserFacingErrorMessage(new TypeError('Failed to fetch'))).toBe(
      '主业务数据服务暂不可用，请检查当前网络后重试；持续异常请联系管理员。',
    );
  });

  it('maps 401 auth errors to a credential-specific login message', () => {
    expect(
      getUserFacingErrorMessage(
        new AppError('Failed to authenticate.', {
          code: 'AUTH',
          status: 401,
        }),
        '登录失败，请稍后重试。',
      ),
    ).toBe('登录失败，邮箱或密码不正确，请重新输入。');
  });

  it('keeps detailed DATA errors instead of replacing them with a generic message', () => {
    expect(
      getUserFacingErrorMessage(
        new AppError('未找到对应的烘焙计划，请确认它仍然存在。', {
          code: 'DATA',
        }),
      ),
    ).toBe('未找到对应的烘焙计划，请确认它仍然存在。');
  });
});
