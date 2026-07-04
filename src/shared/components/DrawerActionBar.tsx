import { Children } from 'react';
import type { ReactNode } from 'react';

import styles from './DrawerActionBar.module.css';

interface DrawerActionBarProps {
  children: ReactNode;
}

const joinClassNames = (...classNames: (false | string | undefined)[]): string => {
  return classNames.filter(Boolean).join(' ');
};

export function DrawerActionBar({ children }: DrawerActionBarProps) {
  const actionCount = Children.toArray(children).filter(Boolean).length;

  return (
    <footer className={joinClassNames(styles.bar, actionCount <= 1 ? styles.single : undefined)}>
      {children}
    </footer>
  );
}
