import { beforeEach, describe, expect, it } from 'vitest';

import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
  type CostTemplate,
} from '@/modules/settings/types';

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

describe('useSettingsStore cost template defaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
    });
  });

  it('keeps the first created template as default when there were no templates before', () => {
    const savedTemplate = useSettingsStore.getState().saveCostTemplate({
      dehydrationRate: 14,
      energyCost: 0,
      laborCost: 0,
      name: '首个模板',
      notes: '',
      otherCost: 0,
      packagingCost: 0,
      roastInputWeightGrams: 200,
      saleUnitWeightGrams: 100,
      targetProfitRate: 30,
    });

    expect(useSettingsStore.getState().costTemplateSettings.defaultTemplateId).toBe(savedTemplate.id);
  });

  it('does not restore a default template after editing when the default was cleared', () => {
    const template = createTemplate();

    useSettingsStore.setState({
      costTemplateSettings: {
        defaultTemplateId: null,
        templates: [template],
        updatedAt: '2026-07-07T09:00:00.000Z',
      },
    });

    useSettingsStore.getState().saveCostTemplate(
      {
        dehydrationRate: 15,
        energyCost: 1,
        laborCost: 2,
        name: '已取消默认的模板',
        notes: '更新后仍不应变回默认',
        otherCost: 3,
        packagingCost: 4,
        roastInputWeightGrams: 220,
        saleUnitWeightGrams: 110,
        targetProfitRate: 32,
      },
      template.id,
    );

    expect(useSettingsStore.getState().costTemplateSettings.defaultTemplateId).toBeNull();
  });
});
