import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

const VIEWPORT_EDGE_PADDING_PX = 12;
const SCROLL_TOLERANCE_PX = 6;
const KEYBOARD_VISIBLE_THRESHOLD_PX = 120;
const KEYBOARD_SETTLE_DELAY_MS = 180;
const MOBILE_EDITING_ATTRIBUTE = 'data-app-mobile-editing';

interface RecenterScrollMetrics {
  currentScrollTop: number;
  maxScrollTop: number;
  targetBottom: number;
  targetTop: number;
  visibleBottom: number;
  visibleTop: number;
}

interface UseMobileKeyboardViewportFocusOptions {
  enabled: boolean;
  fallbackContainerRef: RefObject<HTMLDivElement | null>;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const isTextEditableElement = (element: HTMLElement): boolean => {
  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  if (element instanceof HTMLInputElement) {
    return !element.disabled && !element.readOnly && !NON_TEXT_INPUT_TYPES.has(element.type);
  }

  return element.isContentEditable;
};

const resolveEditableTarget = (eventTarget: EventTarget | null): HTMLElement | null => {
  if (!(eventTarget instanceof HTMLElement)) {
    return null;
  }

  let current: HTMLElement | null = eventTarget;

  while (current) {
    if (isTextEditableElement(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
};

const isScrollableElement = (element: HTMLElement): boolean => {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;

  if (!/(auto|overlay|scroll)/.test(overflowY)) {
    return false;
  }

  return element.scrollHeight > element.clientHeight + 1;
};

const resolveScrollContainer = (
  element: HTMLElement,
  fallbackContainer: HTMLDivElement | null,
): HTMLElement | null => {
  let current: HTMLElement | null = element.parentElement;

  while (current) {
    if (current.classList.contains('ant-drawer-body')) {
      return current;
    }

    if (current.dataset.appScrollViewport === 'true') {
      return current;
    }

    if (isScrollableElement(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return fallbackContainer;
};

const resolveViewportAnchor = (element: HTMLElement): HTMLElement => {
  const fieldContainer = element.closest<HTMLElement>('[data-field-path]');

  if (fieldContainer) {
    return fieldContainer;
  }

  const labelContainer = element.closest<HTMLElement>('label');

  return labelContainer ?? element;
};

const resolveOccludedVisibleBottom = (
  container: HTMLElement,
  fallbackVisibleBottom: number,
): number => {
  if (typeof document !== 'undefined' && document.documentElement.hasAttribute(MOBILE_EDITING_ATTRIBUTE)) {
    return fallbackVisibleBottom;
  }

  const stickyActionBar = container.querySelector<HTMLElement>('[data-drawer-action-bar="true"]');

  if (!stickyActionBar) {
    return fallbackVisibleBottom;
  }

  const stickyActionBarRect = stickyActionBar.getBoundingClientRect();

  if (stickyActionBarRect.height <= 0) {
    return fallbackVisibleBottom;
  }

  return Math.min(fallbackVisibleBottom, stickyActionBarRect.top);
};

const isKeyboardVisible = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

  return window.innerHeight - viewportHeight > KEYBOARD_VISIBLE_THRESHOLD_PX;
};

const syncMobileEditingAttribute = (hidden: boolean) => {
  if (typeof document === 'undefined') {
    return;
  }

  if (hidden) {
    document.documentElement.setAttribute(MOBILE_EDITING_ATTRIBUTE, 'true');
    return;
  }

  document.documentElement.removeAttribute(MOBILE_EDITING_ATTRIBUTE);
};

export const resolveRecenteredScrollTop = ({
  currentScrollTop,
  maxScrollTop,
  targetBottom,
  targetTop,
  visibleBottom,
  visibleTop,
}: RecenterScrollMetrics): number | null => {
  if (visibleBottom <= visibleTop) {
    return null;
  }

  const visibleCenter = (visibleTop + visibleBottom) / 2;
  const targetCenter = (targetTop + targetBottom) / 2;
  const delta = targetCenter - visibleCenter;

  if (Math.abs(delta) <= SCROLL_TOLERANCE_PX) {
    return null;
  }

  const nextScrollTop = clamp(currentScrollTop + delta, 0, maxScrollTop);

  if (Math.abs(nextScrollTop - currentScrollTop) <= 1) {
    return null;
  }

  return nextScrollTop;
};

const syncFocusedFieldIntoViewport = (
  target: HTMLElement,
  fallbackContainer: HTMLDivElement | null,
  behavior: ScrollBehavior,
): void => {
  const container = resolveScrollContainer(target, fallbackContainer);

  if (!container) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const visualViewportTop = window.visualViewport?.offsetTop ?? 0;
  const visualViewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const visualViewportBottom = visualViewportTop + visualViewportHeight;
  const visibleTop = Math.max(containerRect.top, visualViewportTop) + VIEWPORT_EDGE_PADDING_PX;
  const visibleBottom = resolveOccludedVisibleBottom(
    container,
    Math.min(containerRect.bottom, visualViewportBottom) - VIEWPORT_EDGE_PADDING_PX,
  );
  const targetRect = resolveViewportAnchor(target).getBoundingClientRect();
  const nextScrollTop = resolveRecenteredScrollTop({
    currentScrollTop: container.scrollTop,
    maxScrollTop: Math.max(0, container.scrollHeight - container.clientHeight),
    targetBottom: targetRect.bottom,
    targetTop: targetRect.top,
    visibleBottom,
    visibleTop,
  });

  if (nextScrollTop == null) {
    return;
  }

  container.scrollTo({
    top: nextScrollTop,
    behavior,
  });
};

export function useMobileKeyboardViewportFocus({
  enabled,
  fallbackContainerRef,
}: UseMobileKeyboardViewportFocusOptions) {
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const lastFocusedTargetRef = useRef<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const keyboardSettleTimerRef = useRef<number | null>(null);
  const keyboardVisibleRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') {
      activeTargetRef.current = null;
      lastFocusedTargetRef.current = null;
      syncMobileEditingAttribute(false);
      return undefined;
    }

    keyboardVisibleRef.current = isKeyboardVisible();

    const clearPendingSync = () => {
      if (animationFrameRef.current != null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (keyboardSettleTimerRef.current != null) {
        window.clearTimeout(keyboardSettleTimerRef.current);
        keyboardSettleTimerRef.current = null;
      }
    };

    const resolveSyncTarget = () => {
      if (activeTargetRef.current?.isConnected) {
        return activeTargetRef.current;
      }

      if (lastFocusedTargetRef.current?.isConnected) {
        return lastFocusedTargetRef.current;
      }

      if (activeTargetRef.current && !activeTargetRef.current.isConnected) {
        activeTargetRef.current = null;
      }

      if (lastFocusedTargetRef.current && !lastFocusedTargetRef.current.isConnected) {
        lastFocusedTargetRef.current = null;
      }

      return null;
    };

    const syncActionBarVisibility = () => {
      syncMobileEditingAttribute(Boolean(activeTargetRef.current) || keyboardVisibleRef.current);
    };

    const scheduleSync = (behavior: ScrollBehavior = 'auto') => {
      clearPendingSync();
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        const target = resolveSyncTarget();

        if (!target) {
          return;
        }

        syncFocusedFieldIntoViewport(target, fallbackContainerRef.current, behavior);
      });
    };

    const scheduleKeyboardAwareSync = () => {
      scheduleSync('auto');
      keyboardSettleTimerRef.current = window.setTimeout(() => {
        keyboardSettleTimerRef.current = null;
        scheduleSync('smooth');
      }, KEYBOARD_SETTLE_DELAY_MS);
    };

    const handleFocusIn = (event: FocusEvent) => {
      const nextTarget = resolveEditableTarget(event.target);

      if (!nextTarget) {
        return;
      }

      activeTargetRef.current = nextTarget;
      lastFocusedTargetRef.current = nextTarget;
      syncActionBarVisibility();
      scheduleKeyboardAwareSync();
    };

    const handleFocusOut = () => {
      window.requestAnimationFrame(() => {
        const activeElement = resolveEditableTarget(document.activeElement);

        if (!activeElement) {
          activeTargetRef.current = null;
          syncActionBarVisibility();
          return;
        }

        activeTargetRef.current = activeElement;
        lastFocusedTargetRef.current = activeElement;
        syncActionBarVisibility();
      });
    };

    const handleViewportChange = () => {
      const keyboardOpen = isKeyboardVisible();
      keyboardVisibleRef.current = keyboardOpen;

      if (!keyboardOpen && !activeTargetRef.current && lastFocusedTargetRef.current?.isConnected) {
        syncMobileEditingAttribute(false);
        scheduleSync('smooth');
        return;
      }

      syncActionBarVisibility();

      if (!resolveSyncTarget()) {
        return;
      }

      scheduleSync(keyboardOpen ? 'auto' : 'smooth');
    };

    syncActionBarVisibility();
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      clearPendingSync();
      syncMobileEditingAttribute(false);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, [enabled, fallbackContainerRef]);
}
