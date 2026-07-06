import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider, message as antdMessage, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';

import { useAppDisplaySettings } from '@/modules/settings/hooks';
import { ErrorBoundary } from '@/shared/errors/ErrorBoundary';

const getAppHeaderOffset = (currentWindow: Window): number => {
  const rootStyles = currentWindow.getComputedStyle(currentWindow.document.documentElement);
  const headerHeight = Number.parseFloat(rootStyles.getPropertyValue('--app-shell-header-height'));
  const safeOffset = Number.parseFloat(rootStyles.getPropertyValue('--app-safe-top'));
  const resolvedHeaderHeight = Number.isFinite(headerHeight) && headerHeight > 0 ? headerHeight : 58 + (Number.isFinite(safeOffset) ? safeOffset : 0);

  return Math.round(resolvedHeaderHeight + 10);
};

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
  const { appDisplaySettings } = useAppDisplaySettings();

  const themeConfig = useMemo(() => {
    const isDarkMode = appDisplaySettings.themeMode === 'dark';

    return {
      algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        borderRadius: 8,
        colorBgBase: isDarkMode ? '#111113' : '#ffffff',
        colorBgLayout: isDarkMode ? '#0b0b0c' : '#f5f5f7',
        colorInfo: '#007aff',
        colorPrimary: '#007aff',
        colorSuccess: '#34c759',
        colorWarning: '#ff9500',
        colorError: '#ff3b30',
        colorText: isDarkMode ? '#f5f5f7' : '#1d1d1f',
        colorTextSecondary: isDarkMode ? '#a1a1aa' : '#6e6e73',
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
          bodyBg: isDarkMode ? '#0b0b0c' : '#f5f5f7',
          headerBg: isDarkMode ? '#111113' : '#ffffff',
          siderBg: isDarkMode ? '#111113' : '#1d1d1f',
        },
      },
    };
  }, [appDisplaySettings.themeMode]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.appTheme = appDisplaySettings.themeMode;

    return () => {
      delete document.documentElement.dataset.appTheme;
    };
  }, [appDisplaySettings.themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateMessageOffset = () => {
      const top = getAppHeaderOffset(window);

      window.document.documentElement.style.setProperty('--app-message-top', `${String(top)}px`);
      antdMessage.config({
        top,
      });
    };

    updateMessageOffset();
    window.addEventListener('resize', updateMessageOffset);

    return () => {
      window.removeEventListener('resize', updateMessageOffset);
    };
  }, []);

  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <AntApp>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
}
