import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BeanPage } from '@/modules/bean';
import { beanCacheStorageKey } from '@/modules/bean/services';
import { costTemplateSettingsStorageKey } from '@/modules/settings/services/costTemplateSettings.service';
import { supabaseConnectionSettingsStorageKey } from '@/modules/settings/services/supabaseConnectionSettings.service';
import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultCostTemplateSettings,
  createDefaultSupabaseConnectionSettings,
} from '@/modules/settings/types';
import { renderWithQuery } from '@/tests/renderWithProviders';

describe('BeanPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
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

  it('creates a local bean from the drawer and renders it in the inventory list', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: '新增生豆' }));

    expect(await screen.findByText('新增生豆')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('生豆编号'), { target: { value: 'GB-LOCAL-001' } });
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: '测试庄园 水洗 批次' } });
    fireEvent.change(screen.getByLabelText('豆种'), { target: { value: '74110' } });
    fireEvent.change(screen.getByLabelText('产季'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('处理法'), { target: { value: '水洗' } });
    fireEvent.change(screen.getByLabelText('产地国家'), { target: { value: '埃塞俄比亚' } });
    fireEvent.change(screen.getByLabelText('产区'), { target: { value: '古吉' } });
    fireEvent.change(screen.getByLabelText('购买重量'), { target: { value: '30000' } });
    fireEvent.change(screen.getByLabelText('购买总价'), { target: { value: '2100' } });
    fireEvent.change(screen.getByLabelText('最终单份出售重量'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('最终定价'), { target: { value: '88' } });

    fireEvent.click(screen.getByRole('button', { name: /创建生豆/ }));

    expect(await screen.findByText('测试庄园 水洗 批次')).toBeInTheDocument();
    expect(window.localStorage.getItem(beanCacheStorageKey)).toContain('GB-LOCAL-001');
  });
});
