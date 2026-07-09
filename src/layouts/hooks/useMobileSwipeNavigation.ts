import { type RefObject, useEffect, useRef } from 'react';

import type { AppNavigationItem, AppRouteKey } from '@/router/navigation';

const SWIPE_NAVIGATION_MIN_DISTANCE = 56;
const SWIPE_NAVIGATION_MAX_DURATION_MS = 600;
const SWIPE_NAVIGATION_AXIS_LOCK_RATIO = 1.35;

interface TouchSnapshot {
  x: number;
  y: number;
  timestamp: number;
}

interface UseMobileSwipeNavigationOptions {
  bottomNavItems: AppNavigationItem[];
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  isMobileSettingsOpen: boolean;
  navigateByKey: (key: AppRouteKey) => void;
  onCloseSettings: () => void;
  onOpenSettings: () => void;
  selectedKey: AppRouteKey;
}

const interactiveTargetSelector = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="tab"]',
  '[role="textbox"]',
  '[data-prevent-swipe-navigation="true"]',
  '[data-prevent-pull-refresh="true"]',
  '.ant-drawer',
  '.ant-modal',
  '.ant-picker-dropdown',
  '.ant-select-dropdown',
  '.ant-table',
  '.ant-tabs',
].join(',');

const isSwipeNavigationBlockedTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target.closest(interactiveTargetSelector) != null) {
    return true;
  }

  const scrollableElement = target.closest<HTMLElement>('[data-horizontal-scroll="true"]');

  if (scrollableElement != null) {
    return true;
  }

  let currentElement: HTMLElement | null = target;

  while (currentElement != null) {
    if (currentElement.scrollWidth > currentElement.clientWidth + 1) {
      const overflowX = window.getComputedStyle(currentElement).overflowX;

      if (overflowX === 'auto' || overflowX === 'scroll') {
        return true;
      }
    }

    currentElement = currentElement.parentElement;
  }

  return false;
};

const getBottomNavIndex = (items: AppNavigationItem[], selectedKey: AppRouteKey): number => {
  return items.findIndex((item) => item.key === selectedKey);
};

export function useMobileSwipeNavigation({
  bottomNavItems,
  containerRef,
  enabled,
  isMobileSettingsOpen,
  navigateByKey,
  onCloseSettings,
  onOpenSettings,
  selectedKey,
}: UseMobileSwipeNavigationOptions) {
  const touchStartRef = useRef<TouchSnapshot | null>(null);
  const isHorizontalGestureRef = useRef(false);
  const isGestureBlockedRef = useRef(false);
  const optionsRef = useRef({
    bottomNavItems,
    isMobileSettingsOpen,
    navigateByKey,
    onCloseSettings,
    onOpenSettings,
    selectedKey,
  });

  useEffect(() => {
    optionsRef.current = {
      bottomNavItems,
      isMobileSettingsOpen,
      navigateByKey,
      onCloseSettings,
      onOpenSettings,
      selectedKey,
    };
  }, [
    bottomNavItems,
    isMobileSettingsOpen,
    navigateByKey,
    onCloseSettings,
    onOpenSettings,
    selectedKey,
  ]);

  useEffect(() => {
    const container = containerRef.current;

    if (!enabled || container == null) {
      return;
    }

    const resetGesture = () => {
      touchStartRef.current = null;
      isHorizontalGestureRef.current = false;
      isGestureBlockedRef.current = false;
    };

    const handleTouchStart = (event: TouchEvent) => {
      isGestureBlockedRef.current = isSwipeNavigationBlockedTarget(event.target);
      isHorizontalGestureRef.current = false;

      if (isGestureBlockedRef.current) {
        touchStartRef.current = null;
        return;
      }

      const firstTouch = event.touches[0];

      if (firstTouch == null) {
        touchStartRef.current = null;
        return;
      }

      touchStartRef.current = {
        timestamp: Date.now(),
        x: firstTouch.clientX,
        y: firstTouch.clientY,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touchStart = touchStartRef.current;
      const currentTouch = event.touches[0];

      if (touchStart == null || currentTouch == null || isGestureBlockedRef.current) {
        return;
      }

      const deltaX = currentTouch.clientX - touchStart.x;
      const deltaY = currentTouch.clientY - touchStart.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (
        !isHorizontalGestureRef.current &&
        absDeltaX >= 12 &&
        absDeltaX > absDeltaY * SWIPE_NAVIGATION_AXIS_LOCK_RATIO
      ) {
        isHorizontalGestureRef.current = true;
      }

      if (isHorizontalGestureRef.current && event.cancelable) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const touchStart = touchStartRef.current;

      if (touchStart == null || isGestureBlockedRef.current) {
        resetGesture();
        return;
      }

      const endedTouch = event.changedTouches[0];

      if (endedTouch == null) {
        resetGesture();
        return;
      }

      const deltaX = endedTouch.clientX - touchStart.x;
      const deltaY = endedTouch.clientY - touchStart.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      const elapsedMs = Date.now() - touchStart.timestamp;

      resetGesture();

      if (
        elapsedMs > SWIPE_NAVIGATION_MAX_DURATION_MS ||
        absDeltaX < SWIPE_NAVIGATION_MIN_DISTANCE ||
        absDeltaX <= absDeltaY * SWIPE_NAVIGATION_AXIS_LOCK_RATIO
      ) {
        return;
      }

      const {
        bottomNavItems: currentBottomNavItems,
        isMobileSettingsOpen: currentIsMobileSettingsOpen,
        navigateByKey: currentNavigateByKey,
        onCloseSettings: currentOnCloseSettings,
        onOpenSettings: currentOnOpenSettings,
        selectedKey: currentSelectedKey,
      } = optionsRef.current;
      const activeIndex = getBottomNavIndex(currentBottomNavItems, currentSelectedKey);

      if (deltaX > 0) {
        if (currentIsMobileSettingsOpen) {
          return;
        }

        if (activeIndex <= 0) {
          currentOnOpenSettings();
          return;
        }

        const previousItem = currentBottomNavItems[activeIndex - 1];

        if (previousItem != null) {
          currentNavigateByKey(previousItem.key);
        }

        return;
      }

      if (currentIsMobileSettingsOpen) {
        currentOnCloseSettings();
        return;
      }

      const nextItem = currentBottomNavItems[activeIndex + 1];

      if (nextItem != null) {
        currentNavigateByKey(nextItem.key);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', resetGesture);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', resetGesture);
    };
  }, [containerRef, enabled]);
}

