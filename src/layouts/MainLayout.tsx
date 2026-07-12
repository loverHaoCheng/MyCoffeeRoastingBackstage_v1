import Grid from 'antd/es/grid';
import Layout from 'antd/es/layout';
import { type CSSProperties, type ReactNode, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';

import { GlobalPullToRefresh } from '@/app/components/GlobalPullToRefresh';
import { useQuickRefreshAction } from '@/app/hooks/useQuickRefreshAction';
import { useAppDisplaySettings } from '@/modules/settings/hooks';
import { appNavigationItems, type AppRouteKey } from '@/router/navigation';
import type { ViewportFloatingActionButtonProps } from '@/shared/components/ViewportFloatingActionButton.context';
import { useAppStore } from '@/stores/useAppStore';

import { DesktopNavigation } from './components/DesktopNavigation';
import { FloatingActionDock } from './components/FloatingActionDock';
import { MobileAppHeader } from './components/MobileAppHeader';
import { MobileBottomNavigation } from './components/MobileBottomNavigation';
import { MobileSettingsOverlay } from './components/MobileSettingsOverlay';
import { RouteTransitionStage, type RouteTransitionDirection } from './components/RouteTransitionStage';
import { SettingsAuthBar } from './components/SettingsAuthBar';
import { useMobileSwipeNavigation } from './hooks/useMobileSwipeNavigation';
import { useViewportRuntimeFlags } from './hooks/useViewportRuntimeFlags';
import { ViewportScrollContext } from './ViewportContext';
import styles from './MainLayoutShell.module.css';

const { Content } = Layout;
const { useBreakpoint } = Grid;
const MOBILE_ROUTE_TRANSITION_MS = 300;
const FLOATING_ACTION_VISIBILITY_TRANSITION_MS = 220;
const MOBILE_SETTINGS_PANEL_TRANSITION_MS = 260;
const MOBILE_SETTINGS_FALLBACK_PATH = '/production';

export function MainLayout() {
  const { isRefreshing: isQuickRefreshing, refresh } = useQuickRefreshAction();
  const { setSidebarCollapsed, sidebarCollapsed } = useAppStore();
  const { appDisplaySettings, loadAppDisplaySettings } = useAppDisplaySettings();
  const { isStandalonePwa, supportsTouchPullRefresh } = useViewportRuntimeFlags();
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const mobileSettingsPanelScrollRef = useRef<HTMLDivElement | null>(null);
  const currentOutletRef = useRef(outlet);
  const floatingActionCleanupTimerRef = useRef<number | null>(null);
  const floatingActionRegistrationIdRef = useRef(0);
  const routeTransitionTimerRef = useRef<number | null>(null);
  const mobileSettingsPanelTimerRef = useRef<number | null>(null);
  const previousPathnameRef = useRef(location.pathname);
  const lastNonSettingsPathRef = useRef(
    location.pathname === '/settings' ? MOBILE_SETTINGS_FALLBACK_PATH : location.pathname,
  );
  const isWide = screens.md ?? false;
  const bottomNavItems = useMemo(
    () => appNavigationItems.filter((item) => item.showInBottomNav !== false),
    [],
  );
  const [currentOutlet, setCurrentOutlet] = useState(outlet);
  const [previousOutlet, setPreviousOutlet] = useState<ReactNode | null>(null);
  const [floatingActionConfig, setFloatingActionConfig] = useState<null | (ViewportFloatingActionButtonProps & { id: number })>(null);
  const [renderedFloatingActionConfig, setRenderedFloatingActionConfig] = useState<null | ViewportFloatingActionButtonProps>(null);
  const [isFloatingActionVisible, setIsFloatingActionVisible] = useState(false);
  const [isRouteTransitioning, setIsRouteTransitioning] = useState(false);
  const [routeTransitionDirection, setRouteTransitionDirection] =
    useState<RouteTransitionDirection>('forward');
  const [isMobileSettingsPanelMounted, setIsMobileSettingsPanelMounted] = useState(false);
  const [isMobileSettingsPanelVisible, setIsMobileSettingsPanelVisible] = useState(false);

  const selectedKey = useMemo(() => {
    return (
      appNavigationItems.find((item) => location.pathname.startsWith(item.path))?.key ?? 'bean'
    );
  }, [location.pathname]);
  const previousSelectedKeyRef = useRef<AppRouteKey>(selectedKey);
  const activeBottomNavIndex = useMemo(() => {
    const activeIndex = bottomNavItems.findIndex((item) => item.key === selectedKey);

    return activeIndex >= 0 ? activeIndex : 0;
  }, [bottomNavItems, selectedKey]);

  const getPathIndex = useCallback((pathname: string): number => {
    const matchedIndex = bottomNavItems.findIndex((item) => pathname.startsWith(item.path));

    return matchedIndex >= 0 ? matchedIndex : 0;
  }, [bottomNavItems]);

  useEffect(() => {
    loadAppDisplaySettings();
  }, [loadAppDisplaySettings]);

  useEffect(() => {
    previousSelectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    const scrollViewport = scrollViewportRef.current;

    if (scrollViewport) {
      scrollViewport.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto',
      });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    currentOutletRef.current = currentOutlet;
  }, [currentOutlet]);

  useEffect(() => {
    return () => {
      if (floatingActionCleanupTimerRef.current != null) {
        window.clearTimeout(floatingActionCleanupTimerRef.current);
      }

      if (routeTransitionTimerRef.current != null) {
        window.clearTimeout(routeTransitionTimerRef.current);
      }

      if (mobileSettingsPanelTimerRef.current != null) {
        window.clearTimeout(mobileSettingsPanelTimerRef.current);
      }
    };
  }, []);

  const openMobileSettingsPanel = useCallback(() => {
    if (mobileSettingsPanelTimerRef.current != null) {
      window.clearTimeout(mobileSettingsPanelTimerRef.current);
      mobileSettingsPanelTimerRef.current = null;
    }

    setIsMobileSettingsPanelMounted(true);

    window.requestAnimationFrame(() => {
      setIsMobileSettingsPanelVisible(true);
    });
  }, []);

  const closeMobileSettingsPanel = useCallback(() => {
    if (mobileSettingsPanelTimerRef.current != null) {
      window.clearTimeout(mobileSettingsPanelTimerRef.current);
    }

    setIsMobileSettingsPanelVisible(false);
    mobileSettingsPanelTimerRef.current = window.setTimeout(() => {
      setIsMobileSettingsPanelMounted(false);
      mobileSettingsPanelTimerRef.current = null;
    }, MOBILE_SETTINGS_PANEL_TRANSITION_MS);
  }, []);

  useEffect(() => {
    if (isWide) {
      closeMobileSettingsPanel();
    }
  }, [closeMobileSettingsPanel, isWide]);

  useEffect(() => {
    if (location.pathname !== '/settings') {
      lastNonSettingsPathRef.current = location.pathname;
      closeMobileSettingsPanel();
      return;
    }

    if (isWide) {
      return;
    }

    openMobileSettingsPanel();
  }, [closeMobileSettingsPanel, isWide, location.pathname, openMobileSettingsPanel]);

  useEffect(() => {
    if (floatingActionCleanupTimerRef.current != null) {
      window.clearTimeout(floatingActionCleanupTimerRef.current);
      floatingActionCleanupTimerRef.current = null;
    }

    if (floatingActionConfig) {
      setRenderedFloatingActionConfig({
        ariaLabel: floatingActionConfig.ariaLabel,
        icon: floatingActionConfig.icon,
        onClick: floatingActionConfig.onClick,
      });
      setIsFloatingActionVisible(true);
      return;
    }

    setIsFloatingActionVisible(false);
    floatingActionCleanupTimerRef.current = window.setTimeout(() => {
      setRenderedFloatingActionConfig(null);
      floatingActionCleanupTimerRef.current = null;
    }, FLOATING_ACTION_VISIBILITY_TRANSITION_MS);
  }, [floatingActionConfig]);

  useLayoutEffect(() => {
    const nextPathname = location.pathname;
    const previousPathname = previousPathnameRef.current;

    if (routeTransitionTimerRef.current != null) {
      window.clearTimeout(routeTransitionTimerRef.current);
      routeTransitionTimerRef.current = null;
    }

    if (isWide || previousPathname === nextPathname) {
      if (currentOutletRef.current !== outlet) {
        currentOutletRef.current = outlet;
        setCurrentOutlet(outlet);
      }
      setPreviousOutlet(null);
      setIsRouteTransitioning(false);
      previousPathnameRef.current = nextPathname;
      return;
    }

    setRouteTransitionDirection(
      getPathIndex(nextPathname) >= getPathIndex(previousPathname) ? 'forward' : 'backward',
    );
    setPreviousOutlet(currentOutletRef.current);
    currentOutletRef.current = outlet;
    setCurrentOutlet(outlet);
    setIsRouteTransitioning(true);
    previousPathnameRef.current = nextPathname;

    routeTransitionTimerRef.current = window.setTimeout(() => {
      setPreviousOutlet(null);
      setIsRouteTransitioning(false);
      routeTransitionTimerRef.current = null;
    }, MOBILE_ROUTE_TRANSITION_MS);
  }, [getPathIndex, isWide, location.pathname, outlet]);

  const navigateByKey = useCallback((key: AppRouteKey) => {
    if (!isWide && key === 'settings') {
      openMobileSettingsPanel();
      return;
    }

    if (!isWide) {
      closeMobileSettingsPanel();
    }

    const target = appNavigationItems.find((item) => item.key === key);

    if (!target) {
      return;
    }

    startTransition(() => {
      void navigate(target.path);
    });
  }, [closeMobileSettingsPanel, isWide, navigate, openMobileSettingsPanel]);

  const renderSettingsAuthBar = () => (
    <SettingsAuthBar isDesktop={isWide} />
  );

  const renderRoutePanelContent = (routeKey: AppRouteKey, outletNode: ReactNode) => (
    <>
      {routeKey === 'settings' ? renderSettingsAuthBar() : null}
      {outletNode}
    </>
  );

  const registerFloatingAction = useCallback((config: ViewportFloatingActionButtonProps) => {
    const registrationId = floatingActionRegistrationIdRef.current + 1;
    floatingActionRegistrationIdRef.current = registrationId;

    setFloatingActionConfig({
      ...config,
      id: registrationId,
    });

    return () => {
      setFloatingActionConfig((currentConfig) => {
        if (currentConfig?.id !== registrationId) {
          return currentConfig;
        }

        return null;
      });
    };
  }, []);
  const enabledFloatingActionRegistration = useMemo(() => ({
    enabled: true,
    register: registerFloatingAction,
  }), [registerFloatingAction]);
  const disabledFloatingActionRegistration = useMemo(() => ({
    enabled: false,
    register: registerFloatingAction,
  }), [registerFloatingAction]);

  const scrollToTop = () => {
    const scrollViewport = scrollViewportRef.current;

    if (scrollViewport) {
      scrollViewport.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
      return;
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });
  };

  const shouldShowWebRefreshAction = !supportsTouchPullRefresh;
  const shouldShowFloatingActions = isWide && (isFloatingActionVisible || shouldShowWebRefreshAction);
  const isMobileSettingsRoute = !isWide && location.pathname === '/settings';
  const isMobileSettingsOpen = !isWide && isMobileSettingsPanelMounted;
  const mobileHeaderActionConfig =
    !isWide && !isMobileSettingsOpen ? renderedFloatingActionConfig : null;
  const handleMobileHeaderLeftButtonClick = () => {
    if (isMobileSettingsOpen) {
      if (isMobileSettingsRoute) {
        startTransition(() => {
          void navigate(lastNonSettingsPathRef.current, { replace: true });
        });
      }
      closeMobileSettingsPanel();
      return;
    }

    openMobileSettingsPanel();
  };

  useMobileSwipeNavigation({
    bottomNavItems,
    containerRef: scrollViewportRef,
    enabled: !isWide,
    isMobileSettingsOpen,
    navigateByKey,
    onCloseSettings: closeMobileSettingsPanel,
    onOpenSettings: openMobileSettingsPanel,
    selectedKey,
  });

  useMobileSwipeNavigation({
    bottomNavItems,
    containerRef: mobileSettingsPanelScrollRef,
    enabled: !isWide && isMobileSettingsOpen,
    isMobileSettingsOpen,
    navigateByKey,
    onCloseSettings: closeMobileSettingsPanel,
    onOpenSettings: openMobileSettingsPanel,
    selectedKey,
  });

  return (
    <ViewportScrollContext.Provider value={scrollViewportRef}>
      <Layout className={styles.shell} data-mobile={!isWide} data-standalone-pwa={isStandalonePwa}>
        {!isWide ? (
          <MobileAppHeader
            actionConfig={mobileHeaderActionConfig}
            isSettingsOpen={isMobileSettingsOpen}
            onBrandClick={scrollToTop}
            onLeftButtonClick={handleMobileHeaderLeftButtonClick}
          />
        ) : null}

        {isWide ? (
          <DesktopNavigation
            collapsed={sidebarCollapsed}
            items={appNavigationItems}
            onBrandClick={scrollToTop}
            onCollapse={setSidebarCollapsed}
            onNavigate={navigateByKey}
            selectedKey={selectedKey}
          />
        ) : null}

        <Layout className={styles.main}>
          <div className={styles.viewportFrame} data-scaled={appDisplaySettings.scale < 0.999}>
            <div className={styles.scrollViewport} ref={scrollViewportRef}>
              <GlobalPullToRefresh />
              <div
                className={styles.scaleViewport}
                style={
                  {
                    '--layout-content-scale': appDisplaySettings.scale.toFixed(2),
                  } as CSSProperties
                }
              >
                <Content className={styles.content}>
                  <RouteTransitionStage
                    currentOutlet={currentOutlet}
                    disabledFloatingActionRegistration={disabledFloatingActionRegistration}
                    enabledFloatingActionRegistration={enabledFloatingActionRegistration}
                    isMobileSettingsRoute={isMobileSettingsRoute}
                    isRouteTransitioning={isRouteTransitioning}
                    isWide={isWide}
                    pathname={location.pathname}
                    previousOutlet={previousOutlet}
                    previousSelectedKey={previousSelectedKeyRef.current}
                    renderRoutePanelContent={renderRoutePanelContent}
                    routeTransitionDirection={routeTransitionDirection}
                    selectedKey={selectedKey}
                  />
                </Content>
              </div>
            </div>
          </div>
        </Layout>

        {!isWide ? (
          <MobileBottomNavigation
            activeIndex={activeBottomNavIndex}
            isDimmed={isMobileSettingsOpen}
            items={bottomNavItems}
            onNavigate={navigateByKey}
            selectedKey={selectedKey}
          />
        ) : null}

        {!isWide && isMobileSettingsPanelMounted ? (
          <MobileSettingsOverlay
            authBar={renderSettingsAuthBar()}
            isVisible={isMobileSettingsPanelVisible}
            onClose={closeMobileSettingsPanel}
            panelScrollRef={mobileSettingsPanelScrollRef}
          />
        ) : null}

        <FloatingActionDock
          isQuickRefreshing={isQuickRefreshing}
          isVisible={shouldShowFloatingActions}
          onRefresh={() => {
            void refresh();
          }}
          showRefreshAction={shouldShowWebRefreshAction}
          viewportAction={renderedFloatingActionConfig}
        />
      </Layout>
    </ViewportScrollContext.Provider>
  );
}
