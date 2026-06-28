import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { type PropsWithChildren, useState } from 'react';

import { ErrorBoundary } from '@/shared/errors/ErrorBoundary';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 60_000,
          },
        },
      }),
  );

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          borderRadius: 8,
          colorBgBase: '#ffffff',
          colorBgLayout: '#f5f5f7',
          colorPrimary: '#007aff',
          colorInfo: '#007aff',
          colorSuccess: '#34c759',
          colorWarning: '#ff9500',
          colorError: '#ff3b30',
          colorText: '#1d1d1f',
          colorTextSecondary: '#6e6e73',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
        components: {
          Button: {
            controlHeight: 40,
          },
          Card: {
            headerFontSize: 15,
          },
          Layout: {
            bodyBg: '#f5f5f7',
            headerBg: '#ffffff',
            siderBg: '#1d1d1f',
          },
        },
      }}
    >
      <AntApp>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
}
