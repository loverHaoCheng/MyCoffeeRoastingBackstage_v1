import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pocketBaseAuthService } from '@/modules/auth/services/pocketBaseAuth.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';

describe('pocketBaseAuthService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('maps login fetch failures to a descriptive network error', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      pocketBaseAuthService.login({
        email: 'demo@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: 'NETWORK',
      message: expect.stringContaining('PocketBase 鉴权服务'),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8090/api/collections/users/auth-with-password',
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
  });

  it('falls back to the default PocketBase url when legacy Supabase settings are still stored', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            message: 'Failed to authenticate.',
          }),
          {
            status: 400,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'https://goaeusmfpfnzkinuobrg.supabase.co',
        publishableKey: 'legacy-key',
      },
      roastedBean: {
        projectUrl: 'https://goaeusmfpfnzkinuobrg.supabase.co',
        publishableKey: 'legacy-key',
      },
      updatedAt: '2026-07-07T00:00:00.000Z',
    });

    await expect(
      pocketBaseAuthService.login({
        email: 'demo@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH',
      status: 400,
      message: '登录失败，邮箱或密码不正确，请重新输入。',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8090/api/collections/users/auth-with-password',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
