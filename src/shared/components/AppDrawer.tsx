import Drawer from "antd/es/drawer";
import type { DrawerProps } from "antd/es/drawer";
import { useEffect } from 'react';

import styles from './AppDrawer.module.css';

const APP_DRAWER_OPEN_ATTRIBUTE = 'data-app-drawer-open';

let activeDrawerCount = 0;

const joinClassNames = (...classNames: (false | null | undefined | string)[]): string => {
  return classNames.filter(Boolean).join(' ');
};

const syncAppDrawerOpenAttribute = () => {
  if (typeof document === 'undefined') {
    return;
  }

  if (activeDrawerCount > 0) {
    document.documentElement.setAttribute(APP_DRAWER_OPEN_ATTRIBUTE, 'true');
    return;
  }

  document.documentElement.removeAttribute(APP_DRAWER_OPEN_ATTRIBUTE);
};

const registerOpenAppDrawer = () => {
  activeDrawerCount += 1;
  syncAppDrawerOpenAttribute();

  return () => {
    activeDrawerCount = Math.max(0, activeDrawerCount - 1);
    syncAppDrawerOpenAttribute();
  };
};

export function AppDrawer({ className, destroyOnHidden = false, ...props }: DrawerProps) {
  useEffect(() => {
    if (!props.open) {
      return undefined;
    }

    return registerOpenAppDrawer();
  }, [props.open]);

  return <Drawer {...props} className={joinClassNames(styles.drawer, className)} destroyOnHidden={destroyOnHidden} />;
}
