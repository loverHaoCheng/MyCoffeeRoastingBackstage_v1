import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BeanPage } from '@/modules/bean';
import { costTemplateSettingsStorageKey } from '@/modules/settings/services/costTemplateSettings.service';
import { supabaseConnectionSettingsStorageKey } from '@/modules/settings/services/supabaseConnectionSettings.service';
import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultSupabaseConnectionSettings,
} from '@/modules/settings/types';
import { renderWithQuery } from '@/tests/renderWithProviders';

describe('BeanPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      supabaseConnections: createDefaultSupabaseConnectionSettings(),
    });
  });

  it('renders the bean inventory workspace with the current simplified search layout', async () => {
    renderWithQuery(<BeanPage />);

    const summary = screen.getByLabelText('生豆库存概览');

    expect(summary).toBeInTheDocument();
    expect(screen.getByLabelText('生豆库存筛选')).toBeInTheDocument();
    expect(screen.getByLabelText('生豆库存列表')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '同步生豆数据' })).not.toBeInTheDocument();
    expect(within(summary).queryByText('在库批次')).not.toBeInTheDocument();
    expect(within(summary).queryByText('低库存')).not.toBeInTheDocument();
    expect(await screen.findByText('没有匹配的生豆批次')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('搜索生豆'), {
      target: { value: '祈里尼亚加' },
    });

    expect(screen.getByDisplayValue('祈里尼亚加')).toBeInTheDocument();
    expect(screen.getByText('没有匹配的生豆批次')).toBeInTheDocument();
  });

  it('renders the bean page workspace shell', async () => {
    window.localStorage.setItem(
      supabaseConnectionSettingsStorageKey,
      JSON.stringify({
        greenBean: {
          projectUrl: 'https://green-demo.supabase.co',
          publishableKey: 'sb_publishable_green_demo',
        },
        roastedBean: {
          projectUrl: '',
          publishableKey: '',
        },
        updatedAt: '2026-07-03T00:00:00.000Z',
      }),
    );
    window.localStorage.setItem(
      costTemplateSettingsStorageKey,
      JSON.stringify({
        defaultTemplateId: 'template-1',
        templates: [
          {
            id: 'template-1',
            name: '默认模板',
            notes: '',
            roastInputWeightGrams: 200,
            saleUnitWeightGrams: 100,
            dehydrationRate: 14,
            packagingCost: 0,
            energyCost: 0,
            laborCost: 0,
            otherCost: 0,
            targetProfitRate: 30,
            createdAt: '2026-07-03T00:00:00.000Z',
            updatedAt: '2026-07-03T00:00:00.000Z',
          },
        ],
        updatedAt: '2026-07-03T00:00:00.000Z',
      }),
    );
    useSettingsStore.getState().loadSupabaseConnections();
    useSettingsStore.getState().loadCostTemplates();

    renderWithQuery(<BeanPage />);

    expect(await screen.findByText('没有匹配的生豆批次')).toBeInTheDocument();
    expect(screen.getByLabelText('生豆库存筛选')).toBeInTheDocument();
  });
});
