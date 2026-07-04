import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsSyncMocks = vi.hoisted(() => ({
  loadRecord: vi.fn(),
  saveRecord: vi.fn(),
}));

const displaySettingsMocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn((settings: unknown) => settings),
}));

vi.mock('@/modules/settings/services/appSettingsSync.service', () => ({
  appSettingsSyncService: {
    loadRecord: settingsSyncMocks.loadRecord,
    saveRecord: settingsSyncMocks.saveRecord,
  },
}));

vi.mock('@/modules/settings/services/appDisplaySettings.service', () => ({
  appDisplaySettingsService: {
    load: displaySettingsMocks.load,
    save: displaySettingsMocks.save,
  },
}));

import { appDisplaySettingsSyncService } from '@/modules/settings/services/appDisplaySettingsSync.service';
import { createDefaultAppDisplaySettings, normalizeAppDisplaySettings } from '@/modules/settings/types';

describe('appDisplaySettingsSyncService', () => {
  beforeEach(() => {
    settingsSyncMocks.loadRecord.mockReset();
    settingsSyncMocks.saveRecord.mockReset();
    displaySettingsMocks.load.mockReset();
    displaySettingsMocks.save.mockClear();
    displaySettingsMocks.save.mockImplementation((settings: unknown) => settings);
  });

  it('strips theme mode before saving remote settings', async () => {
    const localSettings = normalizeAppDisplaySettings({
      ...createDefaultAppDisplaySettings(),
      themeMode: 'dark',
      updatedAt: '2026-07-04T08:00:00.000Z',
    });

    await appDisplaySettingsSyncService.saveRemote(localSettings);

    expect(settingsSyncMocks.saveRecord).toHaveBeenCalledWith(
      'app_display_settings',
      expect.objectContaining({
        cardDisplaySettings: localSettings.cardDisplaySettings,
        scale: localSettings.scale,
        updatedAt: localSettings.updatedAt,
      }),
    );
    expect(settingsSyncMocks.saveRecord).not.toHaveBeenCalledWith(
      'app_display_settings',
      expect.objectContaining({ themeMode: 'dark' }),
    );
  });

  it('keeps the local theme when syncing a newer remote payload', async () => {
    const localSettings = normalizeAppDisplaySettings({
      ...createDefaultAppDisplaySettings(),
      scale: 1.05,
      themeMode: 'dark',
      updatedAt: '2026-07-04T08:00:00.000Z',
    });

    displaySettingsMocks.load.mockReturnValue(localSettings);
    settingsSyncMocks.loadRecord.mockResolvedValue({
      id: 'record-1',
      key: 'app_display_settings',
      updated_at: '2026-07-04T09:00:00.000Z',
      value: {
        scale: 0.95,
        themeMode: 'light',
        updatedAt: '2026-07-04T09:00:00.000Z',
      },
    });

    const result = await appDisplaySettingsSyncService.sync(localSettings);

    expect(result.themeMode).toBe('dark');
    expect(result.scale).toBe(0.95);
    expect(settingsSyncMocks.saveRecord).not.toHaveBeenCalled();
    expect(displaySettingsMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        themeMode: 'dark',
        scale: 0.95,
      }),
    );
  });
});
