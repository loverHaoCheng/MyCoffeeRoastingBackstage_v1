import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appSettingsSyncService } from '@/modules/settings/services/appSettingsSync.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { roastedBeanSupabaseConnectionSyncService } from '@/modules/settings/services/roastedBeanSupabaseConnectionSync.service';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';

describe('roastedBeanSupabaseConnectionSyncService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    pocketBaseConnectionSettingsService.clear();
    pocketBaseConnectionSettingsService.save(createDefaultPocketBaseConnectionSettings());
    vi.restoreAllMocks();
  });

  it('hydrates roasted bean connection from the remote app_settings record', async () => {
    vi.spyOn(appSettingsSyncService, 'loadRecord').mockResolvedValue({
      id: 'record-1',
      key: 'supabase_roasted_bean_connection_settings',
      updated_at: '2026-07-07T12:00:00.000Z',
      value: {
        projectUrl: 'https://demo.supabase.co/',
        publishableKey: 'sb_publishable_demo',
        updatedAt: '2026-07-07T12:00:00.000Z',
      },
    });

    const result = await roastedBeanSupabaseConnectionSyncService.syncFromRemote();

    expect(result.roastedBean.projectUrl).toBe('https://demo.supabase.co');
    expect(result.roastedBean.publishableKey).toBe('sb_publishable_demo');
    expect(pocketBaseConnectionSettingsService.load().roastedBean.projectUrl).toBe('https://demo.supabase.co');
  });
});
