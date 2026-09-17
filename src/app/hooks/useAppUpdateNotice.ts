import { useEffect, useState } from 'react';
import { Workbox } from 'workbox-window';

import { logger } from '@/shared/logger/logger';

type AppUpdateNotice =
  | {
      message: string;
      type: 'available';
    }
  | {
      message: string;
      type: 'updated';
    };

export function useAppUpdateNotice() {
  const [notice, setNotice] = useState<AppUpdateNotice | null>(null);
  const [workbox, setWorkbox] = useState<Workbox | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const wb = new Workbox('/service-worker.js');

    wb.addEventListener('installed', (event) => {
      if (event.isUpdate) {
        logger.info('new service worker installed', { isUpdate: true });
        setNotice({
          type: 'available',
          message: '检测到线上已有新版本。建议现在刷新页面以应用更新，避免样式或数据结构不一致。',
        });
      } else {
        logger.info('service worker installed', { isUpdate: false });
      }
    });

    wb.addEventListener('waiting', () => {
      logger.info('service worker waiting');
      setNotice({
        type: 'available',
        message: '检测到线上已有新版本。建议现在刷新页面以应用更新,避免样式或数据结构不一致。',
      });
    });

    wb.addEventListener('controlling', () => {
      logger.info('service worker controlling');
      setNotice({
        type: 'updated',
        message: '应用刚完成更新。若你仍看到旧页面内容,建议立即刷新一次,避免本地缓存影响本次更新。',
      });
    });

    wb.register()
      .then((registration) => {
        logger.info('service worker registered', { scope: registration?.scope });
      })
      .catch((error: unknown) => {
        logger.error('service worker registration failed', { error });
      });

    setWorkbox(wb);

    return () => {
      const installedHandler = () => undefined;
      const waitingHandler = () => undefined;
      const controllingHandler = () => undefined;

      wb.removeEventListener('installed', installedHandler);
      wb.removeEventListener('waiting', waitingHandler);
      wb.removeEventListener('controlling', controllingHandler);
    };
  }, []);

  return {
    dismissNotice: () => {
      setNotice(null);
    },
    notice,
    refreshToUpdate: () => {
      if (workbox) {
        workbox.messageSkipWaiting();
        window.location.reload();
      } else {
        window.location.reload();
      }
    },
  };
}
