import type { CSSProperties } from 'react';
import { useMemo } from 'react';

import type { AppNavigationItem, AppRouteKey } from '@/router/navigation';

import styles from './MobileBottomNavigation.module.css';
import { getNavigationIcon } from './navigationIcons';

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
  const visibleItems = useMemo(
    () => items.filter((item) => item.group == null || item.key === 'roast' || item.key === 'roastAssistant'),
    [items],
  );
  const activeItemIndex = visibleItems.findIndex((item) => {
    return item.key === 'roast'
      ? selectedKey === 'roast' || selectedKey === 'production'
      : item.key === selectedKey;
  });
  const isRoastActive = selectedKey === 'roast' || selectedKey === 'production';

  return (
    <nav
      aria-label="主导航"
      className={styles.bottomNav}
      data-dimmed={isDimmed}
      style={
        {
          '--bottom-nav-active-index': activeItemIndex >= 0 ? activeItemIndex : activeIndex,
          '--bottom-nav-columns': visibleItems.length,
          gridTemplateColumns: 'repeat(' + String(visibleItems.length) + ', minmax(0, 1fr))',
        } as CSSProperties
      }
    >
      <div className={styles.bottomNavFrame}>
        <div className={styles.bottomNavSurface}>
          <div className={styles.bottomNavInner}>
            <span aria-hidden="true" className={styles.bottomNavActivePill} />
            {visibleItems.map((item) => (
              <button
                aria-current={item.key === 'roast' ? (isRoastActive ? 'page' : undefined) : (selectedKey === item.key ? 'page' : undefined)}
                className={styles.bottomNavItem}
                data-active={item.key === 'roast' ? isRoastActive : selectedKey === item.key}
                key={item.key}
                onClick={() => {
                  onNavigate(item.key);
                }}
                type="button"
              >
                <span className={styles.bottomNavIcon}>{getNavigationIcon(item.key, item.key === 'roast' ? isRoastActive : selectedKey === item.key)}</span>
                <span className={styles.bottomNavLabel}>{item.key === 'roast' ? '烘焙' : item.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
