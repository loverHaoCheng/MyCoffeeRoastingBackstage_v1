import Grid from 'antd/es/grid';
import { startTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { preloadRoute } from '@/router/routePreload';

import styles from './MobileRoastSubNavigation.module.css';

const { useBreakpoint } = Grid;

export function MobileRoastSubNavigation() {
  const screens = useBreakpoint();
  const location = useLocation();
  const navigate = useNavigate();
  const isWide = screens.md ?? false;
  const isHistory = location.pathname === '/roasts/history';

  if (isWide) {
    return null;
  }

  const navigateToSection = (path: '/roasts/plan' | '/roasts/history', routeKey: 'roast' | 'production') => {
    if (location.pathname === path) {
      return;
    }

    void preloadRoute(routeKey)
      .catch(() => undefined)
      .finally(() => {
        startTransition(() => {
          void navigate(path);
        });
      });
  };

  return (
    <nav aria-label="烘焙导航" className={styles.navigation}>
      <button aria-current={!isHistory ? 'page' : undefined} onClick={() => { navigateToSection('/roasts/plan', 'roast'); }} type="button">烘焙计划</button>
      <button aria-current={isHistory ? 'page' : undefined} onClick={() => { navigateToSection('/roasts/history', 'production'); }} type="button">烘焙历史</button>
    </nav>
  );
}
