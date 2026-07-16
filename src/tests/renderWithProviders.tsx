import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AntApp from 'antd/es/app';
import ConfigProvider from 'antd/es/config-provider';
import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';

export function renderWithQuery(ui: ReactElement): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </AntApp>
    </ConfigProvider>,
  );
}
