import { beforeEach, describe, expect, it } from 'vitest';

import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import { pocketBaseConnectionSettingsStorageKey } from '@/modules/settings/services/pocketBaseConnectionSettings.service';

describe('beanSyncService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('treats PocketBase as online when the project url exists even if publishable key is empty', () => {
    window.localStorage.setItem(
      pocketBaseConnectionSettingsStorageKey,
      JSON.stringify({
        greenBean: {
          projectUrl: 'http://81.70.224.75',
          publishableKey: '',
        },
        roastedBean: {
          projectUrl: '',
          publishableKey: '',
        },
        updatedAt: '2026-07-03T00:00:00.000Z',
      }),
    );

    expect(beanSyncService.isOnline()).toBe(true);
  });
});
