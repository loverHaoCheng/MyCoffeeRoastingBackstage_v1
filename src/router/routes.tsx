import { Spin } from 'antd';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, useLocation, createHashRouter, type RouteObject } from 'react-router-dom';

import { LoginPage, RegisterPage } from '@/modules/auth';
import { MainLayout } from '@/layouts/MainLayout';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';

const BeanPage = lazy(() => import('@/modules/bean').then((module) => ({ default: module.BeanPage })));
const RoastPage = lazy(() =>
  import('@/modules/roast').then((module) => ({ default: module.RoastPage })),
);
const ProductionPage = lazy(() =>
  import('@/modules/production').then((module) => ({ default: module.ProductionPage })),
);
const SettingsPage = lazy(() =>
  import('@/modules/settings').then((module) => ({ default: module.SettingsPage })),
);

const withPageFallback = (children: ReactNode) => {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'grid', minHeight: 320, placeItems: 'center' }}>
          <Spin />
        </div>
      }
    >
      {children}
    </Suspense>
  );
};

const authLoadingFallback = (
  <div style={{ display: 'grid', minHeight: '100vh', placeItems: 'center' }}>
    <Spin tip="正在恢复登录态" />
  </div>
);

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const status = useAuthStore((state) => state.status);

  if (!hasHydrated || status === 'hydrating') {
    return authLoadingFallback;
  }

  if (status !== 'authenticated') {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return children;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const status = useAuthStore((state) => state.status);

  if (!hasHydrated || status === 'hydrating') {
    return authLoadingFallback;
  }

  if (status === 'authenticated') {
    return <Navigate replace to="/beans" />;
  }

  return children;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/beans" replace />,
      },
      {
        path: 'beans',
        element: withPageFallback(<BeanPage />),
      },
      {
        path: 'roasts',
        element: withPageFallback(<RoastPage />),
      },
      {
        path: 'production',
        element: withPageFallback(<ProductionPage />),
      },
      {
        path: 'settings',
        element: withPageFallback(<SettingsPage />),
      },
    ],
  },
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnly>
        <RegisterPage />
      </PublicOnly>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];

export const router = createHashRouter(routes);
