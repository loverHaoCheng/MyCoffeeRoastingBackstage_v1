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
    expect(screen.queryByRole('button', { name: 'setting 设置' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开设置面板' })).toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { name: '界面外观' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '当前数据同步状态' })).not.toBeInTheDocument();
    expect(screen.queryByText('同步状态')).not.toBeInTheDocument();
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

    expect(await screen.findByLabelText('财务时间筛选')).toBeInTheDocument();
    expect(screen.getByText('全部花费')).toBeInTheDocument();
    expect(screen.getByText('已实现收入')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '成本模板' })).toBeInTheDocument();
  });

  it('opens the forgot password route', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const router = createMemoryRouter(routes, {
      initialEntries: ['/forgot-password'],
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

    expect(await screen.findByText('EasyBake')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'lock 发送重置邮件' })).toBeInTheDocument();
    expect(screen.getByText('想起密码了？')).toBeInTheDocument();
  });

  it('opens the public privacy policy route', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const router = createMemoryRouter(routes, {
      initialEntries: ['/privacy'],
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

    expect(await screen.findByRole('heading', { name: '隐私政策' })).toBeInTheDocument();
    expect(screen.getByLabelText('文档信息')).toHaveTextContent('zhc1501705072@163.com');
    expect(screen.getByRole('link', { name: '用户协议' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '数据删除机制' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'close 退出' })).toHaveAttribute('href', '#/login');
  });
});
