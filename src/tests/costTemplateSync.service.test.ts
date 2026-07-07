import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appSettingsSyncService } from '@/modules/settings/services/appSettingsSync.service';
import { costTemplateSettingsService } from '@/modules/settings/services/costTemplateSettings.service';
import { costTemplateSyncService } from '@/modules/settings/services/costTemplateSync.service';
import { createDefaultCostTemplateSettings, type CostTemplate, type CostTemplateSettings } from '@/modules/settings/types';

const createTemplate = (overrides?: Partial<CostTemplate>): CostTemplate => ({
  createdAt: '2026-07-07T09:00:00.000Z',
  dehydrationRate: 14,
  energyCost: 0,
  id: 'template-1',
  laborCost: 0,
  name: '默认成本模板',
  notes: '',
  otherCost: 0,
  packagingCost: 0,
  roastInputWeightGrams: 200,
  saleUnitWeightGrams: 100,
  targetProfitRate: 30,
  updatedAt: '2026-07-07T09:00:00.000Z',
  ...overrides,
});

describe('costTemplateSyncService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('clears local templates when no remote record exists', async () => {
    costTemplateSettingsService.save({
      defaultTemplateId: 'template-1',
      templates: [createTemplate()],
      updatedAt: '2026-07-07T10:00:00.000Z',
    });

    vi.spyOn(appSettingsSyncService, 'loadRecord').mockResolvedValue(null);

    const result = await costTemplateSyncService.syncFromRemote();

    expect(result).toEqual(createDefaultCostTemplateSettings());
    expect(costTemplateSettingsService.load()).toEqual(createDefaultCostTemplateSettings());
  });

  it('persists a cleared default template back to pocket base on local change', async () => {
    const template = createTemplate();
    const localSettings: CostTemplateSettings = {
      defaultTemplateId: null,
      templates: [template],
      updatedAt: '2026-07-07T10:00:00.000Z',
    };

    costTemplateSettingsService.save(localSettings);

    const saveRecordSpy = vi.spyOn(appSettingsSyncService, 'saveRecord').mockResolvedValue();

    const result = await costTemplateSyncService.syncLocalChange(localSettings);

    expect(result.defaultTemplateId).toBeNull();
    expect(saveRecordSpy).toHaveBeenCalledWith(
      'cost_template_settings',
      expect.objectContaining({
        defaultTemplateId: null,
      }),
    );
    expect(costTemplateSettingsService.load().defaultTemplateId).toBeNull();
  });
});
