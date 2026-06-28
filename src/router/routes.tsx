import { Spin } from 'antd';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom';

import { MainLayout } from '@/layouts/MainLayout';

const DashboardPage = lazy(() =>
  import('@/modules/dashboard').then((module) => ({ default: module.DashboardPage })),
);
const BeanPage = lazy(() => import('@/modules/bean').then((module) => ({ default: module.BeanPage })));
const RoastPage = lazy(() =>
  import('@/modules/roast').then((module) => ({ default: module.RoastPage })),
);
const ProductionPage = lazy(() =>
  import('@/modules/production').then((module) => ({ default: module.ProductionPage })),
);
const FinancePage = lazy(() =>
  import('@/modules/finance').then((module) => ({ default: module.FinancePage })),
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

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: withPageFallback(<DashboardPage />),
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
        path: 'inventory',
        element: <Navigate to="/beans" replace />,
      },
      {
        path: 'production',
        element: withPageFallback(<ProductionPage />),
      },
      {
        path: 'finance',
        element: withPageFallback(<FinancePage />),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
];

export const router = createBrowserRouter(routes);
