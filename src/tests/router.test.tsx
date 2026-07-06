import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { App as AntApp, ConfigProvider } from 'antd';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { routes } from '@/router/routes';

describe('router', () => {
  it('opens the bean module route', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const router = createMemoryRouter(routes, {
      initialEntries: ['/beans'],
    });

    render(
      <ConfigProvider>
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </AntApp>
      </ConfigProvider>,
    );

    expect(await screen.findByLabelText('生豆库存概览')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'dashboard 工作台' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'database 生豆库存' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'setting 设置' })).toBeInTheDocument();
  });

  it('opens the settings route', async () => {
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

    render(
      <ConfigProvider>
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </AntApp>
      </ConfigProvider>,
    );

    expect(await screen.findByRole('heading', { name: '生豆数据库' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '当前数据同步状态' })).not.toBeInTheDocument();
    expect(screen.queryByText('同步状态')).not.toBeInTheDocument();
  });

  it('opens the inventory route', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const router = createMemoryRouter(routes, {
      initialEntries: ['/inventory'],
    });

    render(
      <ConfigProvider>
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </AntApp>
      </ConfigProvider>,
    );

    expect(await screen.findByRole('heading', { name: '库存管理' })).toBeInTheDocument();
    expect(screen.getByLabelText('库存管理概览')).toBeInTheDocument();
  });

  it('opens the finance route', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const router = createMemoryRouter(routes, {
      initialEntries: ['/finance'],
    });

    render(
      <ConfigProvider>
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </AntApp>
      </ConfigProvider>,
    );

    expect(await screen.findByRole('heading', { name: '单锅熟豆成本核算' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'bank 核算' })).toBeInTheDocument();
  });
});
