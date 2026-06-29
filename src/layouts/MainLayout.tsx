import {
  ApartmentOutlined,
  DatabaseOutlined,
  FireOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Grid, Layout, Menu } from 'antd';
import { type ReactNode, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { appNavigationItems, type AppRouteKey } from '@/router/navigation';
import { useAppStore } from '@/stores/useAppStore';

import styles from './MainLayout.module.css';

const { Content, Sider } = Layout;
const { useBreakpoint } = Grid;

const iconByRoute: Record<AppRouteKey, ReactNode> = {
  bean: <DatabaseOutlined />,
  roast: <FireOutlined />,
  production: <ApartmentOutlined />,
  settings: <SettingOutlined />,
};

export function MainLayout() {
  const { setSidebarCollapsed, sidebarCollapsed } = useAppStore();
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const isWide = screens.md ?? false;
  const bottomNavItems = useMemo(
    () => appNavigationItems.filter((item) => item.showInBottomNav !== false),
    [],
  );

  const selectedKey = useMemo(() => {
    return (
      appNavigationItems.find((item) => location.pathname.startsWith(item.path))?.key ?? 'bean'
    );
  }, [location.pathname]);

  const menuItems = useMemo(
    () =>
      appNavigationItems.map((item) => ({
        key: item.key,
        icon: iconByRoute[item.key],
        label: item.label,
      })),
    [],
  );

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  }, [location.pathname]);

  const navigateByKey = (key: string) => {
    const target = appNavigationItems.find((item) => item.key === key);

    if (!target) {
      return;
    }

    void navigate(target.path);
  };

  return (
    <Layout className={styles.shell}>
      {isWide ? (
        <Sider
          breakpoint="md"
          className={styles.sider}
          collapsed={sidebarCollapsed}
          collapsedWidth={72}
          collapsible
          onCollapse={setSidebarCollapsed}
          trigger={null}
          width={232}
        >
          <Menu
            className={styles.desktopMenu}
            items={menuItems}
            mode="inline"
            onClick={({ key }) => {
              navigateByKey(key);
            }}
            selectedKeys={[selectedKey]}
          />
        </Sider>
      ) : null}

      <Layout className={styles.main}>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>

      {!isWide ? (
        <>
          <nav
            aria-label="主导航"
            className={styles.bottomNav}
            style={{ gridTemplateColumns: `repeat(${bottomNavItems.length}, minmax(0, 1fr))` }}
          >
            {bottomNavItems.map((item) => (
              <button
                aria-current={selectedKey === item.key ? 'page' : undefined}
                className={styles.bottomNavItem}
                data-active={selectedKey === item.key}
                key={item.key}
                onClick={() => {
                  navigateByKey(item.key);
                }}
                type="button"
              >
                <span className={styles.bottomNavIcon}>{iconByRoute[item.key]}</span>
                <span>{item.shortLabel}</span>
              </button>
            ))}
          </nav>
        </>
      ) : null}
    </Layout>
  );
}
