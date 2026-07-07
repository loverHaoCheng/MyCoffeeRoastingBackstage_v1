import { beforeEach, describe, expect, it } from 'vitest';

import {
  pocketBaseConnectionSettingsService,
  pocketBaseConnectionSettingsStorageKey,
} from '@/modules/settings/services/pocketBaseConnectionSettings.service';

describe('pocketBaseConnectionSettingsService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('fills the default local PocketBase url when the green bean project url is blank', () => {
    window.localStorage.setItem(
      pocketBaseConnectionSettingsStorageKey,
      JSON.stringify({
        greenBean: {
          projectUrl: '',
          publishableKey: '',
        },
        roastedBean: {
          projectUrl: '',
          publishableKey: '',
        },
        updatedAt: '2026-07-07T12:00:00.000Z',
      }),
    );

    const result = pocketBaseConnectionSettingsService.load();

    expect(result.greenBean.projectUrl).toBe('http://127.0.0.1:8090');
    expect(result.roastedBean.projectUrl).toBe('');
  });
});
