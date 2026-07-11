import CheckOutlined from '@ant-design/icons/CheckOutlined';
import LoadingOutlined from '@ant-design/icons/LoadingOutlined';
import { useEffect, useRef, useState } from 'react';

import { useQuickRefreshAction } from '@/app/hooks/useQuickRefreshAction';
import { useViewportScrollContainer } from '@/layouts/ViewportContext';

import styles from './GlobalPullToRefresh.module.css';

const PULL_TRIGGER_RATIO = 0.15;
const PULL_VISUAL_MAX_DISTANCE = 72;
const REFRESH_FEEDBACK_DURATION_MS = 720;
const PULL_HORIZONTAL_LOCK_DISTANCE = 12;
const PULL_AXIS_LOCK_RATIO = 1.35;

interface PullTouchSnapshot {
  x: number;
  y: number;
}

const getPullTriggerDistance = (): number => {
  if (typeof window === 'undefined') {
    return 0;
  }

  const viewportHeight = Math.round(window.innerHeight);

  return Math.max(1, Math.round(viewportHeight * PULL_TRIGGER_RATIO));
};

const isInteractiveOverlayTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('.ant-drawer') ??
      target.closest('.ant-picker-dropdown') ??
      target.closest('.ant-select-dropdown') ??
      target.closest('[data-prevent-pull-refresh="true"]'),
  );
};

export function GlobalPullToRefresh() {
  const scrollContainerRef = useViewportScrollContainer();
  const { isRefreshing, refresh } = useQuickRefreshAction();
  const [pullDistance, setPullDistance] = useState(0);
  const [pullTriggerDistance, setPullTriggerDistance] = useState(() => getPullTriggerDistance());
  const [refreshFeedback, setRefreshFeedback] = useState<null | 'success' | 'warning'>(
    null,
  );
  const [refreshFeedbackText, setRefreshFeedbackText] = useState('');
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const touchStartRef = useRef<null | PullTouchSnapshot>(null);
  const isHorizontalGestureRef = useRef(false);
  const isPullGestureBlockedRef = useRef(false);
  const pullTriggeredRef = useRef(false);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    const syncPullTriggerDistance = () => {
      setPullTriggerDistance(getPullTriggerDistance());
    };

    syncPullTriggerDistance();

    window.addEventListener('resize', syncPullTriggerDistance);
    window.addEventListener('orientationchange', syncPullTriggerDistance);

    return () => {
      window.removeEventListener('resize', syncPullTriggerDistance);
      window.removeEventListener('orientationchange', syncPullTriggerDistance);
    };
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current;

    if (!scrollContainer) {
      return;
    }

    const canTriggerPullRefresh = (): boolean => {
      return scrollContainer.scrollTop <= 0 && !isRefreshingRef.current;
    };

    const setSyncedPullDistance = (nextPullDistance: number) => {
      pullDistanceRef.current = nextPullDistance;
      setPullDistance(nextPullDistance);
    };

    const resetPullGesture = () => {
      touchStartRef.current = null;
      isHorizontalGestureRef.current = false;
      isPullGestureBlockedRef.current = false;
      pullTriggeredRef.current = false;
      setSyncedPullDistance(0);
    };

    const handlePullRefresh = async () => {
      try {
        await refresh({
          checkAppUpdate: true,
          onError: (errorMessage) => {
            setRefreshFeedback('warning');
            setRefreshFeedbackText(errorMessage);
          },
          onSuccess: (feedback) => {
            setRefreshFeedback(feedback.status);
            setRefreshFeedbackText(feedback.text);
          },
          silent: true,
        });
      } finally {
        resetPullGesture();
        window.setTimeout(() => {
          setRefreshFeedback(null);
          setRefreshFeedbackText('');
        }, REFRESH_FEEDBACK_DURATION_MS);
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      isHorizontalGestureRef.current = false;
      isPullGestureBlockedRef.current = isInteractiveOverlayTarget(event.target);

      if (isInteractiveOverlayTarget(event.target)) {
        touchStartRef.current = null;
        return;
      }

      if (!canTriggerPullRefresh()) {
        touchStartRef.current = null;
        isPullGestureBlockedRef.current = true;
        return;
      }

      const firstTouch = event.touches[0];

      touchStartRef.current = firstTouch == null
        ? null
        : {
            x: firstTouch.clientX,
            y: firstTouch.clientY,
          };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (isInteractiveOverlayTarget(event.target)) {
        return;
      }

      if (
        touchStartRef.current == null ||
        isPullGestureBlockedRef.current ||
        pullTriggeredRef.current ||
        scrollContainer.scrollTop > 0
      ) {
        return;
      }

      const currentTouch = event.touches[0];

      if (currentTouch == null) {
        return;
      }

      const deltaX = currentTouch.clientX - touchStartRef.current.x;
      const deltaY = currentTouch.clientY - touchStartRef.current.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (
        !isHorizontalGestureRef.current &&
        absDeltaX >= PULL_HORIZONTAL_LOCK_DISTANCE &&
        absDeltaX > absDeltaY * PULL_AXIS_LOCK_RATIO
      ) {
        isHorizontalGestureRef.current = true;
        isPullGestureBlockedRef.current = true;
        setSyncedPullDistance(0);
        return;
      }

      if (isHorizontalGestureRef.current) {
        setSyncedPullDistance(0);
        return;
      }

      const pullDeltaY = Math.max(0, deltaY);

      if (pullDeltaY <= 0) {
        setSyncedPullDistance(0);
        return;
      }

      setSyncedPullDistance(Math.min(pullTriggerDistance, pullDeltaY));
    };

    const handleTouchEnd = () => {
      if (
        pullDistanceRef.current >= pullTriggerDistance &&
        !isPullGestureBlockedRef.current &&
        !isHorizontalGestureRef.current &&
        !pullTriggeredRef.current
      ) {
        pullTriggeredRef.current = true;
        void handlePullRefresh();
        return;
      }

      resetPullGesture();
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
  }, [isRefreshing, pullTriggerDistance, refresh, scrollContainerRef]);

  return (
    <section
      aria-hidden="true"
      className={styles.pullRefreshDock}
      data-active={pullDistance > 0 || isRefreshing || refreshFeedback != null}
      data-feedback={refreshFeedback ?? 'idle'}
      data-ready={pullDistance >= pullTriggerDistance}
    >
      <div
        className={styles.pullRefreshIndicator}
        style={{
          transform:
            'translateY(' +
            String(Math.max(Math.min(pullDistance, PULL_VISUAL_MAX_DISTANCE) - 18, 0)) +
            'px)',
        }}
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
            ? '正在快速刷新'
            : refreshFeedback === 'success'
              ? refreshFeedbackText || '刷新完成'
              : refreshFeedback === 'warning'
                ? refreshFeedbackText || '刷新异常，请稍后重试'
                : pullDistance >= pullTriggerDistance
                  ? '松开即可快速刷新'
                  : '下拉快速刷新当前数据'}
        </span>
      </div>
    </section>
  );
}
