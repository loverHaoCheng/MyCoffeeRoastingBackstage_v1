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

  it('strips local-only display preferences before saving remote settings', async () => {
    const localSettings = normalizeAppDisplaySettings({
      ...createDefaultAppDisplaySettings(),
      themeMode: 'dark',
      scale: 1.1,
      updatedAt: '2026-07-04T08:00:00.000Z',
    });

    await appDisplaySettingsSyncService.saveRemote(localSettings);

    expect(settingsSyncMocks.saveRecord).toHaveBeenCalledWith(
      'app_display_settings',
      expect.objectContaining({
        cardDisplaySettings: localSettings.cardDisplaySettings,
        updatedAt: localSettings.updatedAt,
      }),
    );
    expect(settingsSyncMocks.saveRecord).not.toHaveBeenCalledWith(
      'app_display_settings',
      expect.objectContaining({ themeMode: 'dark', scale: 1.1 }),
    );
  });

  it('keeps the local scale and theme when syncing a newer remote payload', async () => {
    const localSettings = normalizeAppDisplaySettings({
      ...createDefaultAppDisplaySettings(),
      scale: 1.05,
      themeMode: 'dark',
      updatedAt: '2026-07-04T08:00:00.000Z',
    });
    const remoteCardDisplaySettings = {
      beanInventory: {
        displayCount: 2 as const,
        visibleMetaKeys: ['stock', 'cost'],
      },
      roastBatch: {
        displayCount: 4 as const,
        visibleMetaKeys: ['inputWeight', 'outputWeight', 'lossRate', 'roastPlan'],
      },
      roastPlan: {
        displayCount: 4 as const,
        visibleMetaKeys: ['beanName', 'batchWeight', 'roastLevel', 'status'],
      },
    };

    displaySettingsMocks.load.mockReturnValue(localSettings);
    settingsSyncMocks.loadRecord.mockResolvedValue({
      id: 'record-1',
      key: 'app_display_settings',
      updated_at: '2026-07-04T09:00:00.000Z',
      value: {
        cardDisplaySettings: remoteCardDisplaySettings,
        updatedAt: '2026-07-04T09:00:00.000Z',
      },
    });

    const result = await appDisplaySettingsSyncService.sync(localSettings);

    expect(result.themeMode).toBe('dark');
    expect(result.scale).toBe(1.05);
    expect(result.cardDisplaySettings).toEqual(remoteCardDisplaySettings);
    expect(settingsSyncMocks.saveRecord).not.toHaveBeenCalled();
    expect(displaySettingsMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        themeMode: 'dark',
        scale: 1.05,
        cardDisplaySettings: remoteCardDisplaySettings,
      }),
    );
  });

  it('normalizes a PocketBase timestamp before saving remote display settings in memory', async () => {
    const localSettings = normalizeAppDisplaySettings({
      ...createDefaultAppDisplaySettings(),
      updatedAt: '2026-07-04T08:00:00.000Z',
    });

    settingsSyncMocks.loadRecord.mockResolvedValue({
      id: 'record-1',
      key: 'app_display_settings',
      updated_at: '2026-07-04 09:00:00.000Z',
      value: {
        cardDisplaySettings: localSettings.cardDisplaySettings,
      },
    });

    await appDisplaySettingsSyncService.sync(localSettings);

    expect(displaySettingsMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAt: '2026-07-04T09:00:00.000Z',
      }),
    );
  });
});
