import { useEffect, useLayoutEffect, useState } from 'react';

import { isStandalonePwaRuntime, syncViewportMetrics } from '@/app/services/viewportMetrics.service';

const resolveSupportsTouchPullRefresh = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(pointer: coarse)').matches;
};

export function useViewportRuntimeFlags() {
  const [isStandalonePwa, setIsStandalonePwa] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return isStandalonePwaRuntime(window);
  });
  const [supportsTouchPullRefresh, setSupportsTouchPullRefresh] = useState(() => {
    return resolveSupportsTouchPullRefresh();
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const touchPointerQuery = window.matchMedia('(pointer: coarse)');
    const updateStandaloneState = () => {
      syncViewportMetrics(window, document);
      setIsStandalonePwa(isStandalonePwaRuntime(window));
      setSupportsTouchPullRefresh(resolveSupportsTouchPullRefresh());
    };

    updateStandaloneState();
    mediaQuery.addEventListener('change', updateStandaloneState);
    touchPointerQuery.addEventListener('change', updateStandaloneState);

    return () => {
      mediaQuery.removeEventListener('change', updateStandaloneState);
      touchPointerQuery.removeEventListener('change', updateStandaloneState);
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncViewport = () => {
      syncViewportMetrics(window, document);
    };
    const visualViewport = window.visualViewport;

    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    visualViewport?.addEventListener('resize', syncViewport);
    visualViewport?.addEventListener('scroll', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      visualViewport?.removeEventListener('resize', syncViewport);
      visualViewport?.removeEventListener('scroll', syncViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.standalonePwa = isStandalonePwa ? 'true' : 'false';

    return () => {
      delete document.documentElement.dataset.standalonePwa;
    };
  }, [isStandalonePwa]);

  return {
    isStandalonePwa,
    supportsTouchPullRefresh,
  };
}
