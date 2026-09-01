/* eslint-disable react-refresh/only-export-components */

import Spin from 'antd/es/spin';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, useLocation, createHashRouter, type RouteObject } from 'react-router-dom';

import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { RoastSectionLayout } from '@/layouts/components/RoastSectionLayout';

const MainLayout = lazy(() => import('@/layouts/MainLayout').then((module) => ({ default: module.MainLayout })));
const loadAuthModule = () => import('@/modules/auth');

// Start fetching the shared auth chunk while the router is being initialized.
// The chunk remains separate, but auth navigation does not pay the full request latency.
void loadAuthModule();

const ForgotPasswordPage = lazy(() =>
  loadAuthModule().then((module) => ({ default: module.ForgotPasswordPage })),
);
const LoginPage = lazy(() => loadAuthModule().then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() =>
  loadAuthModule().then((module) => ({ default: module.RegisterPage })),
);
const ResetPasswordPage = lazy(() =>
  loadAuthModule().then((module) => ({ default: module.ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() =>
  loadAuthModule().then((module) => ({ default: module.VerifyEmailPage })),
);
const LegalPage = lazy(() => import('@/modules/legal').then((module) => ({ default: module.LegalPage })));
const BeanPage = lazy(() => import('@/modules/bean').then((module) => ({ default: module.BeanPage })));
// The default authenticated route is the bean inventory; fetch its chunk immediately.
void import('@/modules/bean');
const RoastPage = lazy(() =>
  import('@/modules/roast').then((module) => ({ default: module.RoastPage })),
);
// The roast workspace has two sibling routes. Fetch both page chunks while the
// authenticated shell is mounting so switching between them does not start a
// network request after the user taps the secondary navigation.
void import('@/modules/roast');
const RoastAssistantPage = lazy(() =>
  import('@/modules/roast').then((module) => ({ default: module.RoastAssistantPage })),
);
const ProductionPage = lazy(() =>
  import('@/modules/production').then((module) => ({ default: module.ProductionPage })),
);
void import('@/modules/production');
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
        <div
          aria-label="页面加载中"
          style={{
            alignItems: 'start',
            color: 'var(--app-text-secondary)',
            display: 'grid',
            justifyItems: 'center',
            minHeight: 160,
            paddingTop: 56,
          }}
        >
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
    <Spin fullscreen tip="正在恢复登录态" />
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
    element: withPageFallback(
      <RequireAuth>
        <MainLayout />
      </RequireAuth>,
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
        element: <RoastSectionLayout />,
        children: [
          {
            index: true,
            element: <Navigate replace to="plan" />,
          },
          {
            path: 'plan',
            element: withPageFallback(<RoastPage />),
          },
          {
            path: 'history',
            element: withPageFallback(<ProductionPage />),
          },
        ],
      },
      {
        path: 'roast-assistant',
        element: withPageFallback(<RoastAssistantPage />),
      },
      {
        path: 'production',
        element: <Navigate replace to="/roasts/history" />,
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
    path: '/login',
    element: withPageFallback(
      <PublicOnly>
        <LoginPage />
      </PublicOnly>,
    ),
  },
  {
    path: '/register',
    element: withPageFallback(
      <PublicOnly>
        <RegisterPage />
      </PublicOnly>,
    ),
  },
  {
    path: '/forgot-password',
    element: withPageFallback(<ForgotPasswordPage />),
  },
  {
    path: '/verify-email',
    element: withPageFallback(<VerifyEmailPage />),
  },
  {
    path: '/reset-password',
    element: withPageFallback(<ResetPasswordPage />),
  },
  {
    path: '/terms',
    element: withPageFallback(<LegalPage kind="terms" />),
  },
  {
    path: '/privacy',
    element: withPageFallback(<LegalPage kind="privacy" />),
  },
  {
    path: '/data-deletion',
    element: withPageFallback(<LegalPage kind="dataDeletion" />),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];

export const router = createHashRouter(routes);
