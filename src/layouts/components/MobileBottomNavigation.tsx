import type { CSSProperties } from 'react';

import type { AppNavigationItem, AppRouteKey } from '@/router/navigation';

import styles from '../MainLayout.module.css';
import { iconByRoute } from './navigationIcons';

interface MobileBottomNavigationProps {
  activeIndex: number;
  isDimmed: boolean;
  items: AppNavigationItem[];
  onNavigate: (key: AppRouteKey) => void;
  selectedKey: AppRouteKey;
}

export function MobileBottomNavigation({
  activeIndex,
  isDimmed,
  items,
  onNavigate,
  selectedKey,
}: MobileBottomNavigationProps) {
  return (
    <nav
      aria-label="主导航"
      className={styles.bottomNav}
      data-dimmed={isDimmed}
      style={
        {
          '--bottom-nav-active-index': activeIndex,
          '--bottom-nav-columns': items.length,
          gridTemplateColumns: 'repeat(' + String(items.length) + ', minmax(0, 1fr))',
        } as CSSProperties
      }
    >
      <div className={styles.bottomNavFrame}>
        <div className={styles.bottomNavSurface}>
          <div className={styles.bottomNavInner}>
            <span aria-hidden="true" className={styles.bottomNavActivePill} />
            {items.map((item) => (
              <button
                aria-current={selectedKey === item.key ? 'page' : undefined}
                className={styles.bottomNavItem}
                data-active={selectedKey === item.key}
                key={item.key}
                onClick={() => {
                  onNavigate(item.key);
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
  );
}
