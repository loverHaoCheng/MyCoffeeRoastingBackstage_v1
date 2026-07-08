import { logger } from '@/shared/logger/logger';

const readVersionFromPayload = (payload: unknown): null | string => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  if (!('version' in payload)) {
    return null;
  }

  const version = payload.version;

  return typeof version === 'string' && version.trim().length > 0 ? version.trim() : null;
};

const getVersionManifestUrl = (): null | string => {
  if (typeof window === 'undefined') {
    return null;
  }

  const pageUrl = window.location.href.replace(/#.*$/, '');

  return new URL('version.json', pageUrl).toString();
};

export const checkForAvailableAppUpdate = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) {
    return false;
  }

  const versionManifestUrl = getVersionManifestUrl();

  if (!versionManifestUrl) {
    return false;
  }

  try {
    const requestUrl = new URL(versionManifestUrl);
    requestUrl.searchParams.set('t', String(Date.now()));

    const response = await fetch(requestUrl.toString(), {
      cache: 'no-store',
    });

    if (!response.ok) {
      return false;
    }

    const payload: unknown = await response.json();
    const remoteVersion = readVersionFromPayload(payload);

    return remoteVersion != null && remoteVersion !== __APP_BUILD_VERSION__;
  } catch (error) {
    logger.warn('app version check failed', { error });
    return false;
  }
};
