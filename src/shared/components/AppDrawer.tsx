import { Drawer, type DrawerProps } from 'antd';

import styles from './AppDrawer.module.css';

const joinClassNames = (...classNames: (false | null | undefined | string)[]): string => {
  return classNames.filter(Boolean).join(' ');
};

export function AppDrawer({ className, destroyOnHidden = false, ...props }: DrawerProps) {
  return <Drawer {...props} className={joinClassNames(styles.drawer, className)} destroyOnHidden={destroyOnHidden} />;
}
