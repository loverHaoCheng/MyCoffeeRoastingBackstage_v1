export const appBuildVersionStorageKey = 'coffee-roasting-backstage:last-seen-build-version';
export const appBuildVersionUpdatedEventName = 'coffee-roasting-backstage:app-build-version-updated';

let currentAppBuildVersion: null | string = null;

const emitUpdate = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(appBuildVersionUpdatedEventName));
};

export const appBuildVersionService = {
  clear(): void {
    currentAppBuildVersion = null;
    emitUpdate();
  },
  get(): null | string {
    const value = currentAppBuildVersion;

    return value && value.trim().length > 0 ? value.trim() : null;
  },
  save(version: string): void {
    const normalizedVersion = version.trim();

    if (!normalizedVersion || currentAppBuildVersion === normalizedVersion) {
      return;
    }

    currentAppBuildVersion = normalizedVersion;
    emitUpdate();
  },
};
