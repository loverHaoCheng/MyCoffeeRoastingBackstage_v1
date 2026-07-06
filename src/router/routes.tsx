import { Spin } from 'antd';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, createHashRouter, type RouteObject } from 'react-router-dom';

import { MainLayout } from '@/layouts/MainLayout';

const BeanPage = lazy(() => import('@/modules/bean').then((module) => ({ default: module.BeanPage })));
const RoastPage = lazy(() =>
  import('@/modules/roast').then((module) => ({ default: module.RoastPage })),
);
const InventoryPage = lazy(() =>
  import('@/modules/inventory').then((module) => ({ default: module.InventoryPage })),
);
const ProductionPage = lazy(() =>
  import('@/modules/production').then((module) => ({ default: module.ProductionPage })),
);
const FinancePage = lazy(() =>
  import('@/modules/finance').then((module) => ({ default: module.FinancePage })),
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

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
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
        path: 'inventory',
        element: withPageFallback(<InventoryPage />),
      },
      {
        path: 'production',
        element: withPageFallback(<ProductionPage />),
      },
      {
        path: 'finance',
        element: withPageFallback(<FinancePage />),
      },
      {
        path: 'settings',
        element: withPageFallback(<SettingsPage />),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/beans" replace />,
  },
];

export const router = createHashRouter(routes);
