import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AntApp from 'antd/es/app';
import ConfigProvider from 'antd/es/config-provider';
import antdMessage from 'antd/es/message';
import antdTheme from 'antd/es/theme';
import zhCN from 'antd/locale/zh_CN';
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';

import { useAppDisplaySettings } from '@/modules/settings/hooks';
import { ErrorBoundary } from '@/shared/errors/ErrorBoundary';

const getAppHeaderOffset = (currentWindow: Window): number => {
  const headerElement = currentWindow.document.querySelector<HTMLElement>('[data-app-shell-header="true"]');

  if (headerElement) {
    return Math.round(headerElement.getBoundingClientRect().bottom + 10);
  }

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
            gcTime: 30 * 60_000,
            refetchOnMount: false,
            refetchOnReconnect: false,
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: Number.POSITIVE_INFINITY,
          },
        },
      }),
  );
  const [messageTop, setMessageTop] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return 0;
    }

    return getAppHeaderOffset(window);
  });
  const { appDisplaySettings } = useAppDisplaySettings();

  const themeConfig = useMemo(() => {
    const isDarkMode = appDisplaySettings.themeMode === 'dark';

    return {
      algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        borderRadius: 8,
        colorBgBase: isDarkMode ? '#101012' : '#ffffff',
        colorBgLayout: isDarkMode ? '#09090a' : '#f5f5f7',
        colorInfo: '#111111',
        colorPrimary: '#111111',
        colorSuccess: '#4b5563',
        colorWarning: '#6b7280',
        colorError: '#111111',
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
          bodyBg: isDarkMode ? '#09090a' : '#f5f5f7',
          headerBg: isDarkMode ? '#101012' : '#ffffff',
          siderBg: isDarkMode ? '#101012' : '#1d1d1f',
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

      setMessageTop(top);
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
      <AntApp message={{ top: messageTop }}>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
}
