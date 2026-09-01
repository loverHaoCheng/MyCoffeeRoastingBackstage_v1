import { Outlet } from 'react-router-dom';

import { MobileRoastSubNavigation } from './MobileRoastSubNavigation';
import styles from './RoastSectionLayout.module.css';

export function RoastSectionLayout() {
  return (
    <div className={styles.layout}>
      <MobileRoastSubNavigation />
      <Outlet />
    </div>
  );
}
