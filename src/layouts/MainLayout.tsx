import {
  ApartmentOutlined,
  BankOutlined,
  DatabaseOutlined,
  FireOutlined,
  InboxOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Button, Grid, Layout, Menu } from 'antd';
import { type CSSProperties, type ReactNode, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';

import { GlobalPullToRefresh } from '@/app/components/GlobalPullToRefresh';
import { isStandalonePwaRuntime, syncViewportMetrics } from '@/app/services/viewportMetrics.service';
import { useAppDisplaySettings } from '@/modules/settings/hooks';
import { appNavigationItems, type AppRouteKey } from '@/router/navigation';
import { FloatingActionRegistrationContext, type ViewportFloatingActionButtonProps } from '@/shared/components/ViewportFloatingActionButton.context';
import { useAppStore } from '@/stores/useAppStore';

import { ViewportScrollContext } from './ViewportContext';
import floatingActionStyles from '@/shared/components/ViewportFloatingActionButton.module.css';
import styles from './MainLayout.module.css';

const { Content, Sider } = Layout;
const { useBreakpoint } = Grid;
const MOBILE_ROUTE_TRANSITION_MS = 360;
const FLOATING_ACTION_VISIBILITY_TRANSITION_MS = 220;

type RouteTransitionDirection = 'backward' | 'forward';

const iconByRoute: Record<AppRouteKey, ReactNode> = {
  bean: <DatabaseOutlined />,
  inventory: <InboxOutlined />,
  roast: <ApartmentOutlined />,
  production: <FireOutlined />,
  finance: <BankOutlined />,
  settings: <SettingOutlined />,
};

export function MainLayout() {
  const { setSidebarCollapsed, sidebarCollapsed } = useAppStore();
  const { appDisplaySettings, loadAppDisplaySettings } = useAppDisplaySettings();
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const currentOutletRef = useRef(outlet);
  const floatingActionCleanupTimerRef = useRef<number | null>(null);
  const floatingActionRegistrationIdRef = useRef(0);
  const routeTransitionTimerRef = useRef<number | null>(null);
  const previousPathnameRef = useRef(location.pathname);
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
  const [isStandalonePwa, setIsStandalonePwa] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return isStandalonePwaRuntime(window);
  });
  const [isRouteTransitioning, setIsRouteTransitioning] = useState(false);
  const [routeTransitionDirection, setRouteTransitionDirection] =
    useState<RouteTransitionDirection>('forward');

  const selectedKey = useMemo(() => {
    return (
      appNavigationItems.find((item) => location.pathname.startsWith(item.path))?.key ?? 'bean'
    );
  }, [location.pathname]);
  const activeBottomNavIndex = useMemo(() => {
    const activeIndex = bottomNavItems.findIndex((item) => item.key === selectedKey);

    return activeIndex >= 0 ? activeIndex : 0;
  }, [bottomNavItems, selectedKey]);

  const getPathIndex = useCallback((pathname: string): number => {
    const matchedIndex = bottomNavItems.findIndex((item) => pathname.startsWith(item.path));

    return matchedIndex >= 0 ? matchedIndex : 0;
  }, [bottomNavItems]);

  const menuItems = useMemo(
    () =>
      appNavigationItems.map((item) => ({
        key: item.key,
        icon: iconByRoute[item.key],
        label: item.label,
      })),
    [],
  );

  useEffect(() => {
    loadAppDisplaySettings();
  }, [loadAppDisplaySettings]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const updateStandaloneState = () => {
      syncViewportMetrics(window, document);
      setIsStandalonePwa(isStandalonePwaRuntime(window));
    };

    updateStandaloneState();
    mediaQuery.addEventListener('change', updateStandaloneState);

    return () => {
      mediaQuery.removeEventListener('change', updateStandaloneState);
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
    };
  }, []);

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

  const navigateByKey = (key: string) => {
    const target = appNavigationItems.find((item) => item.key === key);

    if (!target) {
      return;
    }

    startTransition(() => {
      void navigate(target.path);
    });
  };

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

  return (
    <ViewportScrollContext.Provider value={scrollViewportRef}>
      <Layout className={styles.shell} data-mobile={!isWide} data-standalone-pwa={isStandalonePwa}>
        {!isWide ? (
          <button className={styles.mobileBrand} onClick={scrollToTop} type="button">
            EasyBake
          </button>
        ) : null}

        {isWide ? (
          <Sider
            breakpoint="md"
            className={styles.sider}
            collapsed={sidebarCollapsed}
            collapsedWidth={72}
            collapsible
            onCollapse={setSidebarCollapsed}
            trigger={null}
            width={232}
          >
            <button className={styles.desktopBrand} onClick={scrollToTop} type="button">
              EasyBake
            </button>
            <Menu
              className={styles.desktopMenu}
              items={menuItems}
              mode="inline"
              onClick={({ key }) => {
                navigateByKey(key);
              }}
              selectedKeys={[selectedKey]}
            />
          </Sider>
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
                  <div
                    className={styles.routeScene}
                    data-direction={routeTransitionDirection}
                    data-transitioning={!isWide && isRouteTransitioning}
                  >
                    {!isWide && isRouteTransitioning && previousOutlet ? (
                      <div className={styles.routeTrack} data-direction={routeTransitionDirection}>
                        {routeTransitionDirection === 'forward' ? (
                          <>
                            <FloatingActionRegistrationContext.Provider value={disabledFloatingActionRegistration}>
                              <div className={styles.routePanel} data-role="previous">
                                {previousOutlet}
                              </div>
                            </FloatingActionRegistrationContext.Provider>
                            <FloatingActionRegistrationContext.Provider value={enabledFloatingActionRegistration}>
                              <div className={styles.routePanel} data-role="current">
                                {currentOutlet}
                              </div>
                            </FloatingActionRegistrationContext.Provider>
                          </>
                        ) : (
                          <>
                            <FloatingActionRegistrationContext.Provider value={enabledFloatingActionRegistration}>
                              <div className={styles.routePanel} data-role="current">
                                {currentOutlet}
                              </div>
                            </FloatingActionRegistrationContext.Provider>
                            <FloatingActionRegistrationContext.Provider value={disabledFloatingActionRegistration}>
                              <div className={styles.routePanel} data-role="previous">
                                {previousOutlet}
                              </div>
                            </FloatingActionRegistrationContext.Provider>
                          </>
                        )}
                      </div>
                    ) : (
                      <FloatingActionRegistrationContext.Provider value={enabledFloatingActionRegistration}>
                        <div className={styles.routePanel} data-role="current" key={location.pathname}>
                          {currentOutlet}
                        </div>
                      </FloatingActionRegistrationContext.Provider>
                    )}
                  </div>
                </Content>
              </div>
            </div>
          </div>
        </Layout>

        {!isWide ? (
          <nav
            aria-label="主导航"
            className={styles.bottomNav}
            style={
              {
                '--bottom-nav-active-index': activeBottomNavIndex,
                '--bottom-nav-columns': bottomNavItems.length,
                gridTemplateColumns: 'repeat(' + String(bottomNavItems.length) + ', minmax(0, 1fr))',
              } as CSSProperties
            }
          >
            <div className={styles.bottomNavFrame}>
              <div className={styles.bottomNavSurface}>
                <div className={styles.bottomNavInner}>
                  <span aria-hidden="true" className={styles.bottomNavActivePill} />
                  {bottomNavItems.map((item) => (
                    <button
                      aria-current={selectedKey === item.key ? 'page' : undefined}
                      className={styles.bottomNavItem}
                      data-active={selectedKey === item.key}
                      key={item.key}
                      onClick={() => {
                        navigateByKey(item.key);
                      }}
                      type="button"
                    >
                      <span className={styles.bottomNavIcon}>{iconByRoute[item.key]}</span>
                      <span className={styles.bottomNavLabel}>{item.shortLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        ) : null}

        <div
          aria-hidden="true"
          className={styles.floatingActionRoot}
          data-visible={isFloatingActionVisible}
        >
          {renderedFloatingActionConfig ? (
            <Button
              aria-label={renderedFloatingActionConfig.ariaLabel}
              className={floatingActionStyles.button}
              icon={renderedFloatingActionConfig.icon}
              onClick={renderedFloatingActionConfig.onClick}
              shape="circle"
              type="default"
            />
          ) : null}
        </div>
      </Layout>
    </ViewportScrollContext.Provider>
  );
}
