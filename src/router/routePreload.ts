import type { AppRouteKey } from './navigation';

const routeLoaders: Partial<Record<AppRouteKey, () => Promise<unknown>>> = {
  bean: () => import('@/modules/bean'),
  roast: () => import('@/modules/roast/pages/RoastPage'),
  production: () => import('@/modules/production'),
  roastAssistant: () => import('@/modules/roast/pages/RoastAssistantPage'),
  finance: () => import('@/modules/finance'),
  settings: () => import('@/modules/settings'),
};

const preloadCache = new Map<AppRouteKey, Promise<unknown>>();

export const preloadRoute = (routeKey: AppRouteKey): Promise<unknown> => {
  const cached = preloadCache.get(routeKey);

  if (cached) {
    return cached;
  }

  const loader = routeLoaders[routeKey];

  if (!loader) {
    return Promise.resolve();
  }

  const promise = loader().catch((error: unknown) => {
    preloadCache.delete(routeKey);
    throw error;
  });

  preloadCache.set(routeKey, promise);
  return promise;
};

export const preloadAdjacentRoutes = (): void => {
  void preloadRoute('roast').catch(() => undefined);
  void preloadRoute('production').catch(() => undefined);
  void preloadRoute('finance').catch(() => undefined);
  void preloadRoute('settings').catch(() => undefined);
};

// Mobile navigation is touch-first and has no hover opportunity; warm all
// neighboring page chunks as soon as the browser has mounted the app shell.
if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
  window.setTimeout(preloadAdjacentRoutes, 0);
}
