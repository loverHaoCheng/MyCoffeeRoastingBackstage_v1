import { CheckOutlined, LoadingOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { refreshAllAppData } from '@/app/services/appDataRefresh.service';
import { useViewportScrollContainer } from '@/layouts/ViewportContext';

import styles from './GlobalPullToRefresh.module.css';

const PULL_TRIGGER_DISTANCE = 52;
const PULL_MAX_DISTANCE = 84;
const REFRESH_FEEDBACK_DURATION_MS = 720;

const isInteractiveOverlayTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('.ant-drawer') ||
      target.closest('.ant-picker-dropdown') ||
      target.closest('.ant-select-dropdown') ||
      target.closest('[data-prevent-pull-refresh="true"]'),
  );
};

export function GlobalPullToRefresh() {
  const queryClient = useQueryClient();
  const scrollContainerRef = useViewportScrollContainer();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshFeedback, setRefreshFeedback] = useState<null | 'success' | 'warning'>(
    null,
  );
  const [refreshFeedbackText, setRefreshFeedbackText] = useState('');
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const touchStartYRef = useRef<null | number>(null);
  const pullTriggeredRef = useRef(false);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current;

    if (!scrollContainer) {
      return;
    }

    const canTriggerPullRefresh = (): boolean => {
      return scrollContainer.scrollTop <= 0 && !isRefreshingRef.current;
    };

    const handlePullRefresh = async () => {
      setIsRefreshing(true);

      try {
        const result = await refreshAllAppData(queryClient);

        if (result.failed > 0) {
          setRefreshFeedback('warning');
          setRefreshFeedbackText('部分数据刷新失败，将在稍后自动重试');
        } else {
          setRefreshFeedback('success');
          setRefreshFeedbackText(
            result.downloaded > 0 || result.uploaded > 0 || result.success > 0
              ? '刷新完成，数据同步成功'
              : '刷新完成，当前已是最新数据',
          );
        }
      } catch (error) {
        setRefreshFeedback('warning');
        const errorMessage = error instanceof Error ? error.message : '刷新失败，请稍后重试。';
        setRefreshFeedbackText(errorMessage);
      } finally {
        touchStartYRef.current = null;
        pullTriggeredRef.current = false;
        setPullDistance(0);
        setIsRefreshing(false);
        window.setTimeout(() => {
          setRefreshFeedback(null);
          setRefreshFeedbackText('');
        }, REFRESH_FEEDBACK_DURATION_MS);
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (isInteractiveOverlayTarget(event.target)) {
        touchStartYRef.current = null;
        return;
      }

      if (!canTriggerPullRefresh()) {
        touchStartYRef.current = null;
        return;
      }

      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (isInteractiveOverlayTarget(event.target)) {
        return;
      }

      if (touchStartYRef.current == null || pullTriggeredRef.current || scrollContainer.scrollTop > 0) {
        return;
      }

      const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
      const deltaY = Math.max(0, currentY - touchStartYRef.current);

      if (deltaY <= 0) {
        setPullDistance(0);
        return;
      }

      const easedDistance = Math.min(PULL_MAX_DISTANCE, deltaY * 0.34 + Math.sqrt(deltaY) * 3.6);

      setPullDistance(easedDistance);
    };

    const handleTouchEnd = () => {
      if (pullDistanceRef.current >= PULL_TRIGGER_DISTANCE && !pullTriggeredRef.current) {
        pullTriggeredRef.current = true;
        void handlePullRefresh();
        return;
      }

      touchStartYRef.current = null;
      pullTriggeredRef.current = false;
      setPullDistance(0);
    };

    scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
    scrollContainer.addEventListener('touchend', handleTouchEnd);
    scrollContainer.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      scrollContainer.removeEventListener('touchstart', handleTouchStart);
      scrollContainer.removeEventListener('touchmove', handleTouchMove);
      scrollContainer.removeEventListener('touchend', handleTouchEnd);
      scrollContainer.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [queryClient, scrollContainerRef]);

  return (
    <section
      aria-hidden="true"
      className={styles.pullRefreshDock}
      data-active={pullDistance > 0 || isRefreshing || refreshFeedback != null}
      data-feedback={refreshFeedback ?? 'idle'}
      data-ready={pullDistance >= PULL_TRIGGER_DISTANCE}
    >
      <div
        className={styles.pullRefreshIndicator}
        style={{ transform: `translateY(${Math.max(pullDistance - 18, 0)}px)` }}
      >
        {isRefreshing ? (
          <LoadingOutlined spin />
        ) : refreshFeedback === 'success' ? (
          <CheckOutlined />
        ) : (
          <span className={styles.pullRefreshArrow}>↓</span>
        )}
        <span>
          {isRefreshing
            ? '正在刷新全部数据'
            : refreshFeedback === 'success'
              ? refreshFeedbackText || '刷新完成'
              : refreshFeedback === 'warning'
                ? refreshFeedbackText || '刷新异常，请稍后重试'
                : pullDistance >= PULL_TRIGGER_DISTANCE
                  ? '松开即可刷新'
                  : '下拉刷新全部数据'}
        </span>
      </div>
    </section>
  );
}
