import Grid from 'antd/es/grid';

import styles from './MobileRoastSubNavigation.module.css';

const { useBreakpoint } = Grid;

export function MobileRoastSubNavigation() {
  const screens = useBreakpoint();
  const isWide = screens.md ?? false;
  const isHistory = window.location.hash.startsWith('#/roasts/history');

  if (isWide) {
    return null;
  }

  return (
    <nav aria-label="烘焙导航" className={styles.navigation}>
      <button aria-current={!isHistory ? 'page' : undefined} onClick={() => { window.location.hash = '/roasts/plan'; }} type="button">烘焙计划</button>
      <button aria-current={isHistory ? 'page' : undefined} onClick={() => { window.location.hash = '/roasts/history'; }} type="button">烘焙历史</button>
    </nav>
  );
}
