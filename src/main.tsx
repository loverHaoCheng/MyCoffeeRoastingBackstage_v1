import 'antd/dist/reset.css';
import '@ant-design/v5-patch-for-react-19';
import '@/app/styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { syncViewportMetrics } from '@/app/services/viewportMetrics.service';

const ensureViewportFitCover = () => {
  const viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const expectedViewportParts = [
    'viewport-fit=cover',
    'width=device-width',
    'initial-scale=1',
    'maximum-scale=1',
    'minimum-scale=1',
    'user-scalable=no',
  ];

  if (!viewportMeta) {
    const nextMeta = document.createElement('meta');

    nextMeta.name = 'viewport';
    nextMeta.content = expectedViewportParts.join(', ');
    document.head.appendChild(nextMeta);
    return;
  }

  const currentParts = viewportMeta.content
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const mergedParts = [
    ...expectedViewportParts,
    ...currentParts.filter((part) => {
      const key = part.split('=')[0]?.trim();

      return key != null && !expectedViewportParts.some((expectedPart) => expectedPart.startsWith(`${key}=`));
    }),
  ];

  viewportMeta.content = mergedParts.join(', ');
};

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

ensureViewportFitCover();
syncViewportMetrics(window, document);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
