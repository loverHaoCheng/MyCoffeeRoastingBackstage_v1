import Grid from 'antd/es/grid';
import Layout from 'antd/es/layout';
import { type CSSProperties, type ReactNode, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';

import { GlobalPullToRefresh } from '@/app/components/GlobalPullToRefresh';
import { useQuickRefreshAction } from '@/app/hooks/useQuickRefreshAction';
import { useAppDisplaySettings } from '@/modules/settings/hooks';
import { appNavigationItems, type AppRouteKey } from '@/router/navigation';
import { preloadRoute } from '@/router/routePreload';
import type { ViewportFloatingActionButtonProps } from '@/shared/components/ViewportFloatingActionButton.context';
import { usePageGuide } from '@/shared/guides/usePageGuide';

import { DesktopNavigation } from './components/DesktopNavigation';
import { FloatingActionDock } from './components/FloatingActionDock';
import { MobileAppHeader } from './components/MobileAppHeader';
import { MobileBottomNavigation } from './components/MobileBottomNavigation';
import { MobileSettingsOverlay } from './components/MobileSettingsOverlay';
import { RouteTransitionStage } from './components/RouteTransitionStage';
import { SettingsAuthBar } from './components/SettingsAuthBar';
import { useMobileKeyboardViewportFocus } from './hooks/useMobileKeyboardViewportFocus';
import { useViewportRuntimeFlags } from './hooks/useViewportRuntimeFlags';
import { ViewportScrollContext } from './ViewportContext';
import styles from './MainLayoutShell.module.css';

const { Content } = Layout;
const { useBreakpoint } = Grid;
const FLOATING_ACTION_VISIBILITY_TRANSITION_MS = 220;
const MOBILE_SETTINGS_PANEL_TRANSITION_MS = 260;
const MOBILE_SETTINGS_FALLBACK_PATH = '/roasts/history';

export function MainLayout() {
  const { isRefreshing: isQuickRefreshing, refresh } = useQuickRefreshAction();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { appDisplaySettings, loadAppDisplaySettings } = useAppDisplaySettings();
  const { isStandalonePwa, supportsTouchPullRefresh } = useViewportRuntimeFlags();
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const pageGuide = usePageGuide(location.pathname);
  const outlet = useOutlet();
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const mobileSettingsPanelScrollRef = useRef<HTMLDivElement | null>(null);
  const floatingActionCleanupTimerRef = useRef<number | null>(null);
  const floatingActionRegistrationIdRef = useRef(0);
  const headerActionRegistrationIdRef = useRef(0);
  const mobileSettingsPanelTimerRef = useRef<number | null>(null);
  const lastNonSettingsPathRef = useRef(
    location.pathname === '/settings' ? MOBILE_SETTINGS_FALLBACK_PATH : location.pathname,
  );
  const isWide = screens.md ?? false;
  const bottomNavItems = useMemo(
    () => appNavigationItems.filter((item) => item.showInBottomNav !== false),
    [],
  );
  const [floatingActionConfig, setFloatingActionConfig] = useState<null | (ViewportFloatingActionButtonProps & { id: number })>(null);
  const [headerActionConfigs, setHeaderActionConfigs] = useState<ViewportFloatingActionButtonProps[]>([]);
  const [renderedFloatingActionConfig, setRenderedFloatingActionConfig] = useState<null | ViewportFloatingActionButtonProps>(null);
  const [isFloatingActionVisible, setIsFloatingActionVisible] = useState(false);
  const [isMobileSettingsPanelMounted, setIsMobileSettingsPanelMounted] = useState(false);
  const [isMobileSettingsPanelVisible, setIsMobileSettingsPanelVisible] = useState(false);

  const selectedKey = useMemo(() => {
    return (
      appNavigationItems.find((item) => location.pathname.startsWith(item.path))?.key ?? 'bean'
    );
  }, [location.pathname]);
  const activeBottomNavIndex = useMemo(() => {
    const activeIndex = bottomNavItems.findIndex((item) => item.key === selectedKey);

    return activeIndex >= 0 ? activeIndex : 0;
  }, [bottomNavItems, selectedKey]);

  useEffect(() => {
    loadAppDisplaySettings();
  }, [loadAppDisplaySettings]);

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
    return () => {
      if (floatingActionCleanupTimerRef.current != null) {
        window.clearTimeout(floatingActionCleanupTimerRef.current);
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

    // Begin fetching the route chunk before navigation commits the new outlet.
    void preloadRoute(key).catch(() => undefined);

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
  const registerHeaderActions = useCallback((configs: ViewportFloatingActionButtonProps[]) => {
    const registrationId = headerActionRegistrationIdRef.current + 1;
    headerActionRegistrationIdRef.current = registrationId;
    setHeaderActionConfigs(configs);

    return () => {
      if (headerActionRegistrationIdRef.current === registrationId) {
        setHeaderActionConfigs([]);
      }
    };
  }, []);
  const enabledFloatingActionRegistration = useMemo(() => ({
    enabled: true,
    register: registerFloatingAction,
  }), [registerFloatingAction]);
  const enabledHeaderActionRegistration = useMemo(() => ({
    enabled: true,
    register: registerHeaderActions,
  }), [registerHeaderActions]);
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
  const mobileHeaderActionConfigs = !isWide && !isMobileSettingsOpen
    ? [
        ...(pageGuide.action ? [pageGuide.action] : []),
        ...(headerActionConfigs.length > 0 ? headerActionConfigs : renderedFloatingActionConfig ? [renderedFloatingActionConfig] : []),
      ]
    : [];
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

  useMobileKeyboardViewportFocus({
    enabled: !isWide,
    fallbackContainerRef: scrollViewportRef,
  });

  return (
    <ViewportScrollContext.Provider value={scrollViewportRef}>
      <Layout className={styles.shell} data-mobile={!isWide} data-standalone-pwa={isStandalonePwa}>
        {!isWide ? (
          <MobileAppHeader
            actionConfigs={mobileHeaderActionConfigs}
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
          <div className={styles.viewportFrame} data-scaled="false">
            <div className={styles.scrollViewport} data-app-scroll-viewport="true" data-assistant-route={selectedKey === 'roastAssistant'} ref={scrollViewportRef}>
              {selectedKey === 'roastAssistant' ? null : <GlobalPullToRefresh />}
              <div
                className={styles.scaleViewport}
                style={
                  {
                    '--app-font-scale': appDisplaySettings.scale.toFixed(2),
                  } as CSSProperties
                }
              >
                <Content className={styles.content}>
                  <RouteTransitionStage
                    enabledFloatingActionRegistration={enabledFloatingActionRegistration}
                    enabledHeaderActionRegistration={enabledHeaderActionRegistration}
                    isMobileSettingsRoute={isMobileSettingsRoute}
                    outlet={outlet}
                    pathname={location.pathname}
                    renderRoutePanelContent={renderRoutePanelContent}
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
          guideAction={pageGuide.action}
        />
      </Layout>
    </ViewportScrollContext.Provider>
  );
}
