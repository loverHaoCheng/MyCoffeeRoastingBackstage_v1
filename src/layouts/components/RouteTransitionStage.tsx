import type { ReactNode } from 'react';

import type { AppRouteKey } from '@/router/navigation';
import { FloatingActionRegistrationContext, type ViewportFloatingActionButtonProps } from '@/shared/components/ViewportFloatingActionButton.context';

import styles from '../MainLayout.module.css';

export type RouteTransitionDirection = 'backward' | 'forward';

interface FloatingActionRegistrationValue {
  enabled: boolean;
  register: (config: ViewportFloatingActionButtonProps) => () => void;
}

interface RouteTransitionStageProps {
  currentOutlet: ReactNode;
  disabledFloatingActionRegistration: FloatingActionRegistrationValue;
  enabledFloatingActionRegistration: FloatingActionRegistrationValue;
  isMobileSettingsRoute: boolean;
  isRouteTransitioning: boolean;
  isWide: boolean;
  pathname: string;
  previousOutlet: ReactNode | null;
  previousSelectedKey: AppRouteKey;
  renderRoutePanelContent: (routeKey: AppRouteKey, outletNode: ReactNode) => ReactNode;
  routeTransitionDirection: RouteTransitionDirection;
  selectedKey: AppRouteKey;
}

export function RouteTransitionStage({
  currentOutlet,
  disabledFloatingActionRegistration,
  enabledFloatingActionRegistration,
  isMobileSettingsRoute,
  isRouteTransitioning,
  isWide,
  pathname,
  previousOutlet,
  previousSelectedKey,
  renderRoutePanelContent,
  routeTransitionDirection,
  selectedKey,
}: RouteTransitionStageProps) {
  return (
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
                  {renderRoutePanelContent(previousSelectedKey, previousOutlet)}
                </div>
              </FloatingActionRegistrationContext.Provider>
              <FloatingActionRegistrationContext.Provider value={enabledFloatingActionRegistration}>
                <div className={styles.routePanel} data-role="current">
                  {renderRoutePanelContent(selectedKey, currentOutlet)}
                </div>
              </FloatingActionRegistrationContext.Provider>
            </>
          ) : (
            <>
              <FloatingActionRegistrationContext.Provider value={enabledFloatingActionRegistration}>
                <div className={styles.routePanel} data-role="current">
                  {renderRoutePanelContent(selectedKey, currentOutlet)}
                </div>
              </FloatingActionRegistrationContext.Provider>
              <FloatingActionRegistrationContext.Provider value={disabledFloatingActionRegistration}>
                <div className={styles.routePanel} data-role="previous">
                  {renderRoutePanelContent(previousSelectedKey, previousOutlet)}
                </div>
              </FloatingActionRegistrationContext.Provider>
            </>
          )}
        </div>
      ) : (
        <FloatingActionRegistrationContext.Provider value={enabledFloatingActionRegistration}>
          <div className={styles.routePanel} data-role="current" key={pathname}>
            {isMobileSettingsRoute ? null : renderRoutePanelContent(selectedKey, currentOutlet)}
          </div>
        </FloatingActionRegistrationContext.Provider>
      )}
    </div>
  );
}
