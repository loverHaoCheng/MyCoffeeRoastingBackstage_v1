import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BeanPage } from '@/modules/bean';
import { beanCacheStorageKey } from '@/modules/bean/services';
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

  const saveBeanCache = (stockKg: number): void => {
    window.localStorage.setItem(
      beanCacheStorageKey,
      JSON.stringify({
        beans: [
          {
            costPerKg: 86,
            createdAt: '2026-07-03T00:00:00.000Z',
            grade: 'G1',
            id: 'bean-zero-stock',
            name: '零库存测试豆',
            origin: '埃塞俄比亚 · 古吉',
            process: '水洗',
            stockKg,
            updatedAt: '2026-07-03T00:00:00.000Z',
          },
        ],
        errorCode: null,
        lastReadAt: '2026-07-03T00:00:00.000Z',
        source: 'mock',
        status: stockKg > 0 ? 'cached' : 'empty',
        syncedAt: '2026-07-03T00:00:00.000Z',
        version: 1,
      }),
    );
  };

  const saveBeanSummaryCache = (): void => {
    window.localStorage.setItem(
      beanCacheStorageKey,
      JSON.stringify({
        beans: [
          {
            costPerKg: 100,
            createdAt: '2026-07-03T00:00:00.000Z',
            grade: 'G1',
            id: 'bean-a',
            name: '测试豆 A',
            origin: '埃塞俄比亚 · 古吉',
            process: '水洗',
            stockKg: 1,
            updatedAt: '2026-07-03T00:00:00.000Z',
          },
          {
            costPerKg: 200,
            createdAt: '2026-07-03T00:00:00.000Z',
            grade: 'G1',
            id: 'bean-b',
            name: '测试豆 B',
            origin: '哥伦比亚 · 慧兰',
            process: '日晒',
            stockKg: 9,
            updatedAt: '2026-07-03T00:00:00.000Z',
          },
        ],
        errorCode: null,
        lastReadAt: '2026-07-03T00:00:00.000Z',
        source: 'mock',
        status: 'cached',
        syncedAt: '2026-07-03T00:00:00.000Z',
        version: 1,
      }),
    );
  };

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

  it('puts zero-stock beans into a collapsed bottom section and removes them after stock changes', () => {
    saveBeanCache(0);

    const firstRender = renderWithQuery(<BeanPage />);

    const collapsedSection = screen.getByLabelText('零库存生豆折叠区');
    expect(within(collapsedSection).getByText('零库存生豆')).toBeInTheDocument();
    expect(within(collapsedSection).getByRole('button', { name: '零库存生豆' })).toBeInTheDocument();
    expect(within(collapsedSection).queryByText(/重量为 0 的记录/)).not.toBeInTheDocument();
    expect(within(collapsedSection).queryByText('1 条')).not.toBeInTheDocument();
    expect(within(collapsedSection).getByLabelText('零库存生豆列表')).toHaveAttribute(
      'aria-hidden',
      'true',
    );

    fireEvent.click(within(collapsedSection).getByRole('button', { name: '零库存生豆' }));

    expect(within(collapsedSection).getByLabelText('零库存生豆列表')).toHaveAttribute(
      'aria-hidden',
      'false',
    );

    firstRender.unmount();

    window.localStorage.clear();
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      supabaseConnections: createDefaultSupabaseConnectionSettings(),
    });
    saveBeanCache(12.5);

    renderWithQuery(<BeanPage />);

    expect(screen.queryByLabelText('零库存生豆折叠区')).not.toBeInTheDocument();
    expect(screen.getByText('零库存测试豆')).toBeInTheDocument();
  });

  it('calculates the summary average cost with remaining stock weighting', () => {
    saveBeanSummaryCache();

    renderWithQuery(<BeanPage />);

    const summary = screen.getByLabelText('生豆库存概览');

    expect(within(summary).getByText('10 kg')).toBeInTheDocument();
    expect(within(summary).getByText('¥190 / kg')).toBeInTheDocument();
  });
});
