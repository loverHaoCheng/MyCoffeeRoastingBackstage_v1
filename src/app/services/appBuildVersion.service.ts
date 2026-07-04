export const appBuildVersionStorageKey = 'coffee-roasting-backstage:last-seen-build-version';
export const appBuildVersionUpdatedEventName = 'coffee-roasting-backstage:app-build-version-updated';

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const emitUpdate = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(appBuildVersionUpdatedEventName));
};

export const appBuildVersionService = {
  get(): null | string {
    if (!canUseStorage()) {
      return null;
    }

    const value = window.localStorage.getItem(appBuildVersionStorageKey);

    return value && value.trim().length > 0 ? value.trim() : null;
  },
  save(version: string): void {
    if (!canUseStorage()) {
      return;
    }

    const normalizedVersion = version.trim();

    if (!normalizedVersion || window.localStorage.getItem(appBuildVersionStorageKey) === normalizedVersion) {
      return;
    }

    window.localStorage.setItem(appBuildVersionStorageKey, normalizedVersion);
    emitUpdate();
  },
};
