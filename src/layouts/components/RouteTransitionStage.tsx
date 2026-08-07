import type { ReactNode } from 'react';

import type { AppRouteKey } from '@/router/navigation';
import { FloatingActionRegistrationContext, type ViewportFloatingActionButtonProps } from '@/shared/components/ViewportFloatingActionButton.context';

import styles from './RouteTransitionStage.module.css';

interface FloatingActionRegistrationValue {
  enabled: boolean;
  register: (config: ViewportFloatingActionButtonProps) => () => void;
}

interface RouteTransitionStageProps {
  enabledFloatingActionRegistration: FloatingActionRegistrationValue;
  isMobileSettingsRoute: boolean;
  outlet: ReactNode;
  pathname: string;
  renderRoutePanelContent: (routeKey: AppRouteKey, outletNode: ReactNode) => ReactNode;
  selectedKey: AppRouteKey;
}

export function RouteTransitionStage({
  enabledFloatingActionRegistration,
  isMobileSettingsRoute,
  outlet,
  pathname,
  renderRoutePanelContent,
  selectedKey,
}: RouteTransitionStageProps) {
  return (
    <div className={styles.routeScene}>
      <FloatingActionRegistrationContext.Provider value={enabledFloatingActionRegistration}>
        <div className={styles.routePanel} data-role="current" key={pathname}>
          {isMobileSettingsRoute ? null : renderRoutePanelContent(selectedKey, outlet)}
        </div>
      </FloatingActionRegistrationContext.Provider>
    </div>
  );
}
