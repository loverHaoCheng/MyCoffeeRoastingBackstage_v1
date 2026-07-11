import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRealtimeSync } from '@/app/components/AppRealtimeSync';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { pocketBaseSessionService } from '@/services/pocketBaseSession.service';

const { refreshQuickAppDataMock } = vi.hoisted(() => ({
  refreshQuickAppDataMock: vi.fn(),
}));

vi.mock('@/app/services/appDataRefresh.service', async () => {
  const actual = await vi.importActual<typeof import('@/app/services/appDataRefresh.service')>(
    '@/app/services/appDataRefresh.service',
  );

  return {
    ...actual,
    refreshQuickAppData: refreshQuickAppDataMock,
  };
});

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly listeners = new Map<string, Set<EventListener>>();
  readonly url: string;

  closed = false;

  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener): void {
    const current = this.listeners.get(type) ?? new Set<EventListener>();

    current.add(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: string): void {
    const event = { data } as MessageEvent;

    this.listeners.get(type)?.forEach((listener) => {
      listener(event);
    });
  }
}

const renderWithProviders = (ui: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
};

describe('AppRealtimeSync', () => {
  beforeEach(() => {
    refreshQuickAppDataMock.mockReset();
    refreshQuickAppDataMock.mockResolvedValue({
      downloaded: 0,
      failed: 0,
      failedDetails: [],
      success: 0,
      uploaded: 0,
    });
    FakeEventSource.instances = [];
    useAuthStore.setState({
      session: {
        updatedAt: new Date().toISOString(),
        user: {
          email: 'tester@example.com',
          id: 'test-user',
        },
      },
      status: 'authenticated',
      user: {
        email: 'tester@example.com',
        id: 'test-user',
      },
    });
    pocketBaseSessionService.save({
      user: {
        email: 'tester@example.com',
        id: 'test-user',
      },
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      value: FakeEventSource,
      writable: true,
    });
    vi.useRealTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
      }),
    );
  });

  it('subscribes to PocketBase realtime updates after connect', async () => {
    renderWithProviders(<AppRealtimeSync />);

    expect(FakeEventSource.instances).toHaveLength(1);
    const realtimeConnection = FakeEventSource.instances[0];

    realtimeConnection?.emit('PB_CONNECT', 'client-123');

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/realtime$/),
      expect.objectContaining({
        body: JSON.stringify({
          clientId: 'client-123',
          subscriptions: [
            'app_settings/*',
            'bean_sale_specs/*',
            'green_beans/*',
            'green_bean_purchase_batches/*',
            'roast_batches/*',
            'roast_profiles/*',
          ],
        }),
        credentials: 'same-origin',
        method: 'POST',
      }),
    );
  });

  it('refreshes the current scope when a subscribed topic changes', async () => {
    vi.useFakeTimers();
    window.location.hash = '#/roasts';

    const { queryClient } = renderWithProviders(<AppRealtimeSync />);
    const realtimeConnection = FakeEventSource.instances[0];

    refreshQuickAppDataMock.mockClear();
    realtimeConnection?.emit('green_beans/*', '{"action":"update"}');
    vi.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();

    expect(refreshQuickAppDataMock).toHaveBeenCalledWith(queryClient, 'roast');
  });
});
