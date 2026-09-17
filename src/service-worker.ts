/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

const SW_VERSION = '__APP_BUILD_VERSION__';

void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } | undefined;

  if (data?.type === 'GET_VERSION') {
    if (event.ports[0]) {
      event.ports[0].postMessage({ version: SW_VERSION });
    }
  }

  if (data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
