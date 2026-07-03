import { useEffect, useState } from 'react';

import { logger } from '@/shared/logger/logger';

const appBuildVersionStorageKey = 'coffee-roasting-backstage:last-seen-build-version';
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

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const getVersionManifestUrl = (): null | string => {
  if (typeof window === 'undefined') {
    return null;
  }

  const pageUrl = window.location.href.replace(/#.*$/, '');

  return new URL('version.json', pageUrl).toString();
};

const readVersionFromPayload = (payload: unknown): null | string => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const version = Reflect.get(payload, 'version');

  return typeof version === 'string' && version.trim().length > 0 ? version.trim() : null;
};

export function useAppUpdateNotice() {
  const [notice, setNotice] = useState<AppUpdateNotice | null>(null);

  useEffect(() => {
    if (!canUseStorage()) {
      return;
    }

    try {
      const lastSeenVersion = window.localStorage.getItem(appBuildVersionStorageKey);

      if (lastSeenVersion && lastSeenVersion !== __APP_BUILD_VERSION__) {
        setNotice({
          type: 'updated',
          message: '应用刚完成更新。若你仍看到旧页面内容，建议立即刷新一次，避免本地缓存影响本次更新。',
        });
      }

      window.localStorage.setItem(appBuildVersionStorageKey, __APP_BUILD_VERSION__);
    } catch (error) {
      logger.warn('app build version persistence failed', { error });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) {
      return;
    }

    const versionManifestUrl = getVersionManifestUrl();

    if (!versionManifestUrl) {
      return;
    }

    let disposed = false;

    const checkForUpdate = async () => {
      try {
        const response = await fetch(`${versionManifestUrl}?t=${Date.now()}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as unknown;
        const remoteVersion = readVersionFromPayload(payload);

        if (!remoteVersion || remoteVersion === __APP_BUILD_VERSION__ || disposed) {
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
