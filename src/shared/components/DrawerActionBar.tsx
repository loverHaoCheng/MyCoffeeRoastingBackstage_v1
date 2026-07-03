import { Children } from 'react';
import type { ReactNode } from 'react';

import styles from './DrawerActionBar.module.css';

interface DrawerActionBarProps {
  children: ReactNode;
}

export function DrawerActionBar({ children }: DrawerActionBarProps) {
  const actionCount = Children.toArray(children).filter(Boolean).length;

  return (
    <footer className={`${styles.bar} ${actionCount <= 1 ? styles.single : ''}`}>
      {children}
    </footer>
  );
}
