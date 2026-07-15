import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pocketBaseAuthService } from '@/modules/auth/services/pocketBaseAuth.service';
import { pocketBaseSessionService } from '@/services/pocketBaseSession.service';
import { AppError } from '@/shared/errors/AppError';

describe('pocketBaseAuthService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    pocketBaseSessionService.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    pocketBaseSessionService.clear();
  });

  it('maps login fetch failures to a descriptive network error', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await pocketBaseAuthService.login({
        email: 'demo@example.com',
        password: 'password123',
      });
      throw new Error('Expected login to reject.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppError);

      if (error instanceof AppError) {
        expect(error.code).toBe('NETWORK');
        expect(error.message).toContain('登录网关');
      }
    }

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('maps duplicate email registration failures to a specific business message', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              email: {
                code: 'validation_not_unique',
                message: 'The email is invalid or already in use.',
              },
            },
            message: 'Failed to create record.',
          }),
          {
            status: 400,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      pocketBaseAuthService.register({
        email: 'demo@example.com',
        password: 'password123',
        passwordConfirm: 'password123',
      }),
    ).rejects.toMatchObject({
      code: 'BUSINESS',
      status: 400,
      message: '注册失败，该邮箱已被使用，请更换后重试。',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('returns a verification-required registration result without auto login', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            email: 'demo@example.com',
            message: '注册成功，验证邮件已发送，请先完成邮箱验证后再登录。',
            verificationEmailSent: true,
            verificationRequired: true,
          }),
          {
            status: 201,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await pocketBaseAuthService.register({
      email: 'demo@example.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });

    expect(result).toEqual({
      email: 'demo@example.com',
      message: '注册成功，验证邮件已发送，请先完成邮箱验证后再登录。',
      verificationEmailSent: true,
      verificationRequired: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pocketBaseSessionService.load()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        body: JSON.stringify({
          email: 'demo@example.com',
          password: 'password123',
          passwordConfirm: 'password123',
        }),
        method: 'POST',
      }),
    );
  });

  it('confirms an email verification token through the auth gateway', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            message: '邮箱验证成功，现在可以登录 EasyBake。',
            success: true,
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(pocketBaseAuthService.confirmVerification('verification-token')).resolves.toEqual({
      message: '邮箱验证成功，现在可以登录 EasyBake。',
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/confirm-verification',
      expect.objectContaining({
        body: JSON.stringify({ token: 'verification-token' }),
        method: 'POST',
      }),
    );
  });

  it('confirms a password reset through the auth gateway', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            message: '密码已重置，现在可以使用新密码登录。',
            success: true,
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      pocketBaseAuthService.confirmPasswordReset('reset-token', 'password123', 'password123'),
    ).resolves.toEqual({
      message: '密码已重置，现在可以使用新密码登录。',
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/confirm-password-reset',
      expect.objectContaining({
        body: JSON.stringify({
          password: 'password123',
          passwordConfirm: 'password123',
          token: 'reset-token',
        }),
        method: 'POST',
      }),
    );
  });

  it('turns upstream 5xx login failures into a gateway-specific message', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            message: 'PocketBase service unavailable',
          }),
          {
            status: 503,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      pocketBaseAuthService.login({
        email: 'demo@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: 'HTTP',
      status: 503,
      message: '登录网关暂时不可用，请稍后重试。',
    });
  });

  it('maps html gateway failures without leaking JSON parse errors', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response('<!doctype html><html><body>Internal Server Error</body></html>', {
          headers: {
            'Content-Type': 'text/html',
          },
          status: 500,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await pocketBaseAuthService.login({
        email: 'demo@example.com',
        password: 'password123',
      });
      throw new Error('Expected login to reject.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppError);

      if (error instanceof AppError) {
        expect(error.code).toBe('HTTP');
        expect(error.status).toBe(500);
        expect(error.message).toContain('非 JSON 错误页面');
      }
    }
  });

  it('surfaces the unverified-email login guidance from the gateway', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'EMAIL_NOT_VERIFIED',
            email: 'demo@example.com',
            message: '该邮箱尚未完成验证，请先前往邮箱完成验证后再登录。',
          }),
          {
            status: 403,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      pocketBaseAuthService.login({
        email: 'demo@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH',
      status: 403,
      message: '该邮箱尚未完成验证，请先前往邮箱完成验证后再登录。',
    });
  });

  it('restores a public user session from the auth gateway without retaining a token', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            record: {
              email: 'demo@example.com',
              id: 'user-1',
              name: '烘焙师 A',
              verified: true,
              username: 'demo',
            },
          }),
          {
            status: 200,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const session = await pocketBaseAuthService.restoreSession();

    expect(session).toMatchObject({
      user: {
        email: 'demo@example.com',
        id: 'user-1',
        name: '烘焙师 A',
        verified: true,
        username: 'demo',
      },
    });
    expect(pocketBaseSessionService.load()).toMatchObject({
      user: {
        email: 'demo@example.com',
        id: 'user-1',
        name: '烘焙师 A',
      },
    });
    expect(session).not.toHaveProperty('token');
    expect(pocketBaseSessionService.load()).not.toHaveProperty('token');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('updates the current user nickname through the auth gateway and refreshes the in-memory session', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            record: {
              email: 'demo@example.com',
              id: 'user-1',
              name: '新的昵称',
              verified: true,
              username: 'demo',
            },
          }),
          {
            status: 200,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await pocketBaseAuthService.updateProfileName('新的昵称');

    expect(session).toMatchObject({
      user: {
        email: 'demo@example.com',
        id: 'user-1',
        name: '新的昵称',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/profile',
      expect.objectContaining({
        body: JSON.stringify({
          name: '新的昵称',
        }),
        method: 'PATCH',
      }),
    );
    expect(pocketBaseSessionService.getUser()).toMatchObject({
      email: 'demo@example.com',
      id: 'user-1',
      name: '新的昵称',
    });
  });

  it('clears the in-memory session when logging out', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
          }),
          {
            status: 200,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    pocketBaseSessionService.save({
      user: {
        email: 'demo@example.com',
        id: 'user-1',
      },
    });

    await pocketBaseAuthService.logout();

    expect(pocketBaseSessionService.load()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('clears the in-memory session when deleting the account through the auth gateway', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            message: '账号已注销，所有关联数据已删除。',
            success: true,
          }),
          {
            status: 200,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    pocketBaseSessionService.save({
      user: {
        email: 'demo@example.com',
        id: 'user-1',
      },
    });

    const result = await pocketBaseAuthService.deleteAccount();

    expect(result).toEqual({
      message: '账号已注销，所有关联数据已删除。',
      success: true,
    });
    expect(pocketBaseSessionService.load()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/account',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });

  it('requests a verification email through the auth gateway', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            message: '如果该邮箱已注册，验证邮件已发送，请注意查收。',
            success: true,
          }),
          {
            status: 200,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await pocketBaseAuthService.requestVerification('demo@example.com');

    expect(result).toEqual({
      message: '如果该邮箱已注册，验证邮件已发送，请注意查收。',
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/request-verification',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('requests a password reset email through the auth gateway', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            message: '如果该邮箱已注册，重置密码邮件已发送，请注意查收。',
            success: true,
          }),
          {
            status: 200,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await pocketBaseAuthService.requestPasswordReset('demo@example.com');

    expect(result).toEqual({
      message: '如果该邮箱已注册，重置密码邮件已发送，请注意查收。',
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/request-password-reset',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
