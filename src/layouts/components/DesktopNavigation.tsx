import Layout from 'antd/es/layout';
import Menu from 'antd/es/menu';
import { useMemo } from 'react';

import type { AppNavigationItem, AppRouteKey } from '@/router/navigation';

import styles from './DesktopNavigation.module.css';
import { getNavigationIcon } from './navigationIcons';

const { Sider } = Layout;

interface DesktopNavigationProps {
  collapsed: boolean;
  items: AppNavigationItem[];
  onBrandClick: () => void;
  onCollapse: (collapsed: boolean) => void;
  onNavigate: (key: AppRouteKey) => void;
  selectedKey: AppRouteKey;
}

export function DesktopNavigation({
  collapsed,
  items,
  onBrandClick,
  onCollapse,
  onNavigate,
  selectedKey,
}: DesktopNavigationProps) {
  const menuItems = useMemo(
    () =>
      items.map((item) => ({
        key: item.key,
        icon: getNavigationIcon(item.key, selectedKey === item.key),
        label: item.label,
      })),
    [items, selectedKey],
  );

  return (
    <Sider
      breakpoint="md"
      className={styles.sider}
      collapsed={collapsed}
      collapsedWidth={72}
      collapsible
      onCollapse={onCollapse}
      trigger={null}
      width={232}
    >
      <button className={styles.desktopBrand} onClick={onBrandClick} type="button">
        EasyBake
      </button>
      <Menu
        className={styles.desktopMenu}
        items={menuItems}
        mode="inline"
        onClick={({ key }) => {
          onNavigate(key as AppRouteKey);
        }}
        selectedKeys={[selectedKey]}
      />
    </Sider>
  );
}
