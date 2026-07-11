import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  type AppRefreshScope,
  refreshQuickAppData,
  resolveCurrentAppRefreshScope,
} from '@/app/services/appDataRefresh.service';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { logger } from '@/shared/logger/logger';

import type { AppRouteKey } from '@/router/navigation';

const REALTIME_CONNECT_EVENT = 'PB_CONNECT';
const REALTIME_REFRESH_DEBOUNCE_MS = 320;
const REALTIME_SUBSCRIPTIONS = [
  'app_settings/*',
  'bean_sale_specs/*',
  'green_beans/*',
  'green_bean_purchase_batches/*',
  'roast_batches/*',
  'roast_profiles/*',
] as const;

const TOPIC_SCOPE_MAP: Record<(typeof REALTIME_SUBSCRIPTIONS)[number], AppRouteKey[]> = {
  'app_settings/*': ['bean', 'production', 'roast', 'settings'],
  'bean_sale_specs/*': ['bean'],
  'green_beans/*': ['bean', 'production', 'roast'],
  'green_bean_purchase_batches/*': ['bean'],
  'roast_batches/*': ['bean', 'production', 'roast'],
  'roast_profiles/*': ['production', 'roast'],
};

const getRealtimeEndpoint = (): string => '/api/realtime';

const shouldSyncTopicForScope = (
  topic: (typeof REALTIME_SUBSCRIPTIONS)[number],
  scope: AppRefreshScope,
): boolean => {
  if (scope === 'all') {
    return true;
  }

  return TOPIC_SCOPE_MAP[topic].includes(scope);
};

const parseClientId = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (typeof parsed === 'string') {
      return parsed.trim();
    }

    if (typeof parsed === 'object' && parsed != null) {
      const record = parsed as Record<string, unknown>;
      return typeof record.clientId === 'string' ? record.clientId.trim() : trimmed;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

export function AppRealtimeSync() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document === 'undefined') {
      return true;
    }

    return document.visibilityState !== 'hidden';
  });
  const eventSourceRef = useRef<EventSource | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);
  const hasPendingRefreshRef = useRef(false);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      const nextIsVisible = document.visibilityState !== 'hidden';

      setIsPageVisible(nextIsVisible);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isPageVisible) {
      return;
    }

    const triggerRefresh = () => {
      if (isRefreshingRef.current) {
        hasPendingRefreshRef.current = true;
        return;
      }

      isRefreshingRef.current = true;

      void refreshQuickAppData(queryClient, resolveCurrentAppRefreshScope())
        .catch((error: unknown) => {
          logger.warn('realtime visibility sync failed', { error });
        })
        .finally(() => {
          isRefreshingRef.current = false;

          if (hasPendingRefreshRef.current) {
            hasPendingRefreshRef.current = false;
            triggerRefresh();
          }
        });
    };

    triggerRefresh();

    const handleOnline = () => {
      triggerRefresh();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isAuthenticated, isPageVisible, queryClient]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !isPageVisible ||
      typeof window === 'undefined' ||
      typeof EventSource === 'undefined'
    ) {
      return;
    }

    const endpoint = getRealtimeEndpoint();
    const eventSource = new EventSource(endpoint);
    eventSourceRef.current = eventSource;

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current != null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshTimeoutRef.current = null;

        if (isRefreshingRef.current) {
          hasPendingRefreshRef.current = true;
          return;
        }

        isRefreshingRef.current = true;

        void refreshQuickAppData(queryClient, resolveCurrentAppRefreshScope())
          .catch((error: unknown) => {
            logger.warn('realtime data sync failed', { error });
          })
          .finally(() => {
            isRefreshingRef.current = false;

            if (hasPendingRefreshRef.current) {
              hasPendingRefreshRef.current = false;
              scheduleRefresh();
            }
          });
      }, REALTIME_REFRESH_DEBOUNCE_MS);
    };

    const subscribeAllTopics = async (clientId: string) => {
      if (!clientId) {
        return;
      }

      try {
        const response = await fetch(endpoint, {
          body: JSON.stringify({
            clientId,
            subscriptions: [...REALTIME_SUBSCRIPTIONS],
          }),
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });

        if (!response.ok) {
          const responseText = await response.text();

          logger.warn('pocketbase realtime subscribe failed', {
            clientId,
            responseText,
            status: response.status,
          });
        }
      } catch (error) {
        logger.warn('pocketbase realtime subscribe request failed', { error });
      }
    };

    const handleConnect = (event: Event) => {
      const messageEvent = event as MessageEvent;
      const clientId = parseClientId(messageEvent.data);

      void subscribeAllTopics(clientId);
    };

    const eventHandlers = new Map<string, EventListener>();

    REALTIME_SUBSCRIPTIONS.forEach((topic) => {
      const handler: EventListener = () => {
        const currentScope = resolveCurrentAppRefreshScope();

        if (!shouldSyncTopicForScope(topic, currentScope)) {
          return;
        }

        scheduleRefresh();
      };

      eventHandlers.set(topic, handler);
      eventSource.addEventListener(topic, handler);
    });

    eventSource.addEventListener(REALTIME_CONNECT_EVENT, handleConnect);
    eventSource.onerror = (error) => {
      logger.warn('pocketbase realtime connection error', { error });
    };

    return () => {
      eventSource.removeEventListener(REALTIME_CONNECT_EVENT, handleConnect);
      eventHandlers.forEach((handler, topic) => {
        eventSource.removeEventListener(topic, handler);
      });
      eventSource.close();
      eventSourceRef.current = null;

      if (refreshTimeoutRef.current != null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated, isPageVisible, queryClient]);

  return null;
}
