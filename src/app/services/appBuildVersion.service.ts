export const appBuildVersionStorageKey = 'coffee-roasting-backstage:last-seen-build-version';
export const appBuildVersionUpdatedEventName = 'coffee-roasting-backstage:app-build-version-updated';

let currentAppBuildVersion: null | string = null;

const readPersistedVersion = (): null | string => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.localStorage.getItem(appBuildVersionStorageKey);

    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
};

const emitUpdate = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(appBuildVersionUpdatedEventName));
};

export const appBuildVersionService = {
  clear(): void {
    currentAppBuildVersion = null;

    try {
      window.localStorage.removeItem(appBuildVersionStorageKey);
    } catch {
      // Restricted storage should not block authentication state cleanup.
    }

    emitUpdate();
  },
  get(): null | string {
    const value = currentAppBuildVersion ?? readPersistedVersion();

    if (value != null) {
      currentAppBuildVersion = value;
    }

    return value && value.trim().length > 0 ? value.trim() : null;
  },
  save(version: string): void {
    const normalizedVersion = version.trim();

    if (!normalizedVersion || currentAppBuildVersion === normalizedVersion) {
      return;
    }

    currentAppBuildVersion = normalizedVersion;

    try {
      window.localStorage.setItem(appBuildVersionStorageKey, normalizedVersion);
    } catch {
      // Private browsing or restricted storage should not block startup.
    }

    emitUpdate();
  },
};
