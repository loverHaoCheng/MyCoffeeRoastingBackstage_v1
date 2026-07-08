import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { routes } from '@/router/routes';
import { pocketBaseSessionService } from '@/services/pocketBaseSession.service';

const renderSettingsRoute = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const router = createMemoryRouter(routes, {
    initialEntries: ['/settings'],
  });

  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>,
  );
};

describe('MainLayout auth bar', () => {
  beforeEach(() => {
    pocketBaseSessionService.clear();
    useAuthStore.setState({
      hasHydrated: true,
      session: {
        baseUrl: 'http://81.70.224.75',
        token: 'test-token',
        updatedAt: '2026-07-08T14:00:00.000Z',
        user: {
          email: 'test@qq.com',
          id: 'user-1',
        },
      },
      status: 'authenticated',
      user: {
        email: 'test@qq.com',
        id: 'user-1',
      },
    });
  });

  it('opens the nickname drawer from the settings auth bar and saves the nickname', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            record: {
              email: 'test@qq.com',
              id: 'user-1',
              name: '测试昵称',
              verified: true,
            },
            token: 'test-token',
          }),
          {
            status: 200,
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderSettingsRoute();

    const nicknameButton = await screen.findByRole('button', { name: '设置昵称' });
    fireEvent.click(nicknameButton);

    expect(await screen.findByText('修改昵称')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('请输入昵称，留空则不显示');
    fireEvent.change(input, { target: { value: '测试昵称' } });
    fireEvent.click(screen.getByRole('button', { name: /保存昵称/ }));

    await waitFor(() => {
      expect(useAuthStore.getState().user?.name).toBe('测试昵称');
    });

    expect(await screen.findByRole('button', { name: '测试昵称' })).toBeInTheDocument();

    const emailText = screen.getByText('test@qq.com');
    expect(emailText.className).toContain('authEmail');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/profile',
      expect.objectContaining({
        body: JSON.stringify({
          name: '测试昵称',
        }),
        method: 'PATCH',
      }),
    );
  });
});
