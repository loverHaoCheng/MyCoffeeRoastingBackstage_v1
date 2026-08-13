import Layout from 'antd/es/layout';
import Menu from 'antd/es/menu';
import FireOutlined from '@ant-design/icons/FireOutlined';
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
    () => {
      const roastItems = items.filter((item) => item.group === 'roast');
      const primaryItems = items.filter((item) => item.group !== 'roast');
      const roastGroupIndex = items.findIndex((item) => item.group === 'roast');
      const primaryItemsBeforeRoastGroup = items
        .slice(0, roastGroupIndex)
        .filter((item) => item.group !== 'roast').length;
      const primaryMenuItems = primaryItems.map((item) => ({
        key: item.key,
        icon: getNavigationIcon(item.key, selectedKey === item.key),
        label: item.label,
      }));
      const roastGroup = roastItems.length > 0
        ? {
            key: 'roast-group',
            icon: <FireOutlined />,
            label: '烘焙',
            children: roastItems.map((item) => ({
              key: item.key,
              icon: getNavigationIcon(item.key, selectedKey === item.key),
              label: item.label,
            })),
          }
        : null;

      return roastGroup
        ? [
            ...primaryMenuItems.slice(0, primaryItemsBeforeRoastGroup),
            roastGroup,
            ...primaryMenuItems.slice(primaryItemsBeforeRoastGroup),
          ]
        : primaryMenuItems;
    },
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
