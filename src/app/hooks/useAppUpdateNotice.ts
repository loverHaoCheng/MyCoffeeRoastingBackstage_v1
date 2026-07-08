import { useEffect, useState } from 'react';

import { checkForAvailableAppUpdate } from '@/app/services/appVersionCheck.service';
import { appBuildVersionService } from '@/app/services/appBuildVersion.service';
import { logger } from '@/shared/logger/logger';
const versionCheckIntervalMs = 60_000;

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

  useEffect(() => {
    try {
      const lastSeenVersion = appBuildVersionService.get();

      if (lastSeenVersion && lastSeenVersion !== __APP_BUILD_VERSION__) {
        setNotice({
          type: 'updated',
          message: '应用刚完成更新。若你仍看到旧页面内容，建议立即刷新一次，避免本地缓存影响本次更新。',
        });
      }

      appBuildVersionService.save(__APP_BUILD_VERSION__);
    } catch (error) {
      logger.warn('app build version persistence failed', { error });
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    const checkForUpdate = async () => {
      try {
        const hasAvailableUpdate = await checkForAvailableAppUpdate();

        if (!hasAvailableUpdate || disposed) {
          return;
        }

        setNotice((current) => {
          if (current?.type === 'updated') {
            return current;
          }

          return {
            type: 'available',
            message: '检测到线上已有新版本。当前页面可能仍在使用旧缓存，建议现在刷新，避免样式或数据结构不一致。',
          };
        });
      } catch (error) {
        logger.warn('app version check failed', { error });
      }
    };

    void checkForUpdate();

    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, versionCheckIntervalMs);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    dismissNotice: () => {
      setNotice(null);
    },
    notice,
    refreshToUpdate: () => {
      window.location.reload();
    },
  };
}
