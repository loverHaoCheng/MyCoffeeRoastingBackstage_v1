import {
  ApartmentOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DollarCircleOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { Grid, Layout, Menu } from 'antd';
import { type ReactNode, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { appNavigationItems, type AppRouteKey } from '@/router/navigation';
import { useAppStore } from '@/stores/useAppStore';

import styles from './MainLayout.module.css';

const { Content, Sider } = Layout;
const { useBreakpoint } = Grid;

const iconByRoute: Record<AppRouteKey, ReactNode> = {
  dashboard: <DashboardOutlined />,
  bean: <DatabaseOutlined />,
  roast: <FireOutlined />,
  production: <ApartmentOutlined />,
  finance: <DollarCircleOutlined />,
};

export function MainLayout() {
  const { setSidebarCollapsed, sidebarCollapsed } = useAppStore();
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const isWide = screens.md ?? false;

  const selectedKey = useMemo(() => {
    return (
      appNavigationItems.find((item) => location.pathname.startsWith(item.path))?.key ?? 'dashboard'
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
          <div className={styles.brand} data-collapsed={sidebarCollapsed}>
            <span className={styles.brandMark}>焙</span>
            {!sidebarCollapsed ? (
              <div className={styles.brandText}>
                <strong>咖啡烘焙</strong>
                <span>Roasting OS</span>
              </div>
            ) : null}
          </div>
          <Menu
            className={styles.desktopMenu}
            items={menuItems}
            mode="inline"
            onClick={({ key }) => {
              navigateByKey(key);
            }}
            selectedKeys={[selectedKey]}
            theme="dark"
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
          <nav aria-label="主导航" className={styles.bottomNav}>
            {appNavigationItems.map((item) => (
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
