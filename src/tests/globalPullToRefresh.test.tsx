import { App as AntApp, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRef, type ReactNode } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalPullToRefresh } from '@/app/components/GlobalPullToRefresh';
import { ViewportScrollContext } from '@/layouts/ViewportContext';

const { refreshQuickAppDataMock } = vi.hoisted(() => ({
  refreshQuickAppDataMock: vi.fn(),
}));

const { checkForAvailableAppUpdateMock } = vi.hoisted(() => ({
  checkForAvailableAppUpdateMock: vi.fn(),
}));

vi.mock('@/app/services/appDataRefresh.service', () => ({
  refreshQuickAppData: refreshQuickAppDataMock,
}));

vi.mock('@/app/services/appVersionCheck.service', () => ({
  checkForAvailableAppUpdate: checkForAvailableAppUpdateMock,
}));

const renderWithProviders = (ui: ReactNode) => {
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
};

describe('GlobalPullToRefresh', () => {
  beforeEach(() => {
    refreshQuickAppDataMock.mockReset();
    refreshQuickAppDataMock.mockResolvedValue({
      downloaded: 0,
      failed: 0,
      success: 0,
      uploaded: 0,
    });
    checkForAvailableAppUpdateMock.mockReset();
    checkForAvailableAppUpdateMock.mockResolvedValue(false);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
      writable: true,
    });
  });

  it('requires pulling to 15% of the viewport height before triggering refresh', async () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const scrollContainer = document.createElement('div');
    scrollContainerRef.current = scrollContainer;

    const { container } = renderWithProviders(
      <ViewportScrollContext.Provider value={scrollContainerRef}>
        <GlobalPullToRefresh />
      </ViewportScrollContext.Provider>,
    );

    const section = container.querySelector('section');

    expect(section).not.toBeNull();
    if (section == null) {
      throw new Error('pull refresh section not found');
    }

    const sectionElement = section;

    fireEvent.touchStart(scrollContainer, {
      touches: [{ clientY: 0 }],
    });
    fireEvent.touchMove(scrollContainer, {
      touches: [{ clientY: 119 }],
    });
    fireEvent.touchEnd(scrollContainer);

    await waitFor(() => {
      expect(refreshQuickAppDataMock).not.toHaveBeenCalled();
    });

    fireEvent.touchStart(scrollContainer, {
      touches: [{ clientY: 0 }],
    });
    fireEvent.touchMove(scrollContainer, {
      touches: [{ clientY: 120 }],
    });

    await waitFor(() => {
      expect(sectionElement).toHaveAttribute('data-ready', 'true');
    });

    fireEvent.touchEnd(scrollContainer);

    await waitFor(() => {
      expect(refreshQuickAppDataMock).toHaveBeenCalledTimes(1);
    });
  });

  it('caps the pull hint at a fixed height instead of following the finger indefinitely', async () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const scrollContainer = document.createElement('div');
    scrollContainerRef.current = scrollContainer;

    const { container } = renderWithProviders(
      <ViewportScrollContext.Provider value={scrollContainerRef}>
        <GlobalPullToRefresh />
      </ViewportScrollContext.Provider>,
    );

    const section = container.querySelector('section');

    expect(section).not.toBeNull();
    if (section == null) {
      throw new Error('pull refresh section not found');
    }

    const indicator = section.querySelector('div');

    expect(indicator).not.toBeNull();
    if (indicator == null) {
      throw new Error('pull refresh indicator not found');
    }

    fireEvent.touchStart(scrollContainer, {
      touches: [{ clientY: 0 }],
    });
    fireEvent.touchMove(scrollContainer, {
      touches: [{ clientY: 100 }],
    });

    await waitFor(() => {
      expect(indicator).toHaveStyle({ transform: 'translateY(54px)' });
    });

    fireEvent.touchMove(scrollContainer, {
      touches: [{ clientY: 500 }],
    });

    await waitFor(() => {
      expect(indicator).toHaveStyle({ transform: 'translateY(54px)' });
    });

    fireEvent.touchEnd(scrollContainer);

    await waitFor(() => {
      expect(refreshQuickAppDataMock).toHaveBeenCalledTimes(1);
    });
  });

  it('reloads the page when a newer web version is detected during pull refresh', async () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const scrollContainer = document.createElement('div');
    scrollContainerRef.current = scrollContainer;
    const reloadSpy = vi.fn();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: window.location.href,
        protocol: window.location.protocol,
        reload: reloadSpy,
      },
    });
    checkForAvailableAppUpdateMock.mockResolvedValue(true);

    renderWithProviders(
      <ViewportScrollContext.Provider value={scrollContainerRef}>
        <GlobalPullToRefresh />
      </ViewportScrollContext.Provider>,
    );

    fireEvent.touchStart(scrollContainer, {
      touches: [{ clientY: 0 }],
    });
    fireEvent.touchMove(scrollContainer, {
      touches: [{ clientY: 120 }],
    });
    fireEvent.touchEnd(scrollContainer);

    await waitFor(() => {
      expect(refreshQuickAppDataMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(checkForAvailableAppUpdateMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });
  });
});
