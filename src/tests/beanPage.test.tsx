import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BeanPage } from '@/modules/bean';
import { beanCacheService } from '@/modules/bean/services';
import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
} from '@/modules/settings/types';
import { renderWithQuery } from '@/tests/renderWithProviders';

describe('BeanPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    beanCacheService.clear();
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
    });
  });

  const saveBeanCache = (stockKg: number): void => {
    beanCacheService.save(
      [
        {
          agingDays: 14,
          costPerKg: 86,
          createdAt: '2026-07-03T00:00:00.000Z',
          flavorTags: ['柑橘', '花香'],
          grade: 'G1',
          id: 'bean-zero-stock',
          name: '零库存测试豆',
          origin: '埃塞俄比亚 · 古吉',
          process: '水洗',
          stockKg,
          tastingEndDays: 40,
          updatedAt: '2026-07-03T00:00:00.000Z',
        },
      ],
      'mock',
    );
  };

  const saveBeanSummaryCache = (): void => {
    beanCacheService.save(
      [
        {
          agingDays: 14,
          costPerKg: 100,
          createdAt: '2026-07-03T00:00:00.000Z',
          flavorTags: ['柑橘', '花香'],
          grade: 'G1',
          id: 'bean-a',
          name: '测试豆 A',
          origin: '埃塞俄比亚 · 古吉',
          process: '水洗',
          stockKg: 1,
          tastingEndDays: 40,
          updatedAt: '2026-07-03T00:00:00.000Z',
        },
        {
          agingDays: 21,
          costPerKg: 200,
          createdAt: '2026-07-03T00:00:00.000Z',
          flavorTags: ['黑巧克力', '坚果'],
          grade: 'G1',
          id: 'bean-b',
          name: '测试豆 B',
          origin: '哥伦比亚 · 慧兰',
          process: '日晒',
          stockKg: 9,
          tastingEndDays: 45,
          updatedAt: '2026-07-03T00:00:00.000Z',
        },
      ],
      'mock',
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

    beanCacheService.clear();
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
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

  it('opens the full bean form drawer from the card level edit button', async () => {
    saveBeanSummaryCache();

    renderWithQuery(<BeanPage />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 测试豆 A' }));

    expect(await screen.findByText('编辑生豆')).toBeInTheDocument();
  });

  it('matches flavor tags with fuzzy keyword search', async () => {
    saveBeanSummaryCache();

    renderWithQuery(<BeanPage />);

    fireEvent.change(screen.getByLabelText('搜索生豆'), {
      target: { value: '柑' },
    });

    expect(await screen.findByText('测试豆 A')).toBeInTheDocument();
    expect(screen.queryByText('测试豆 B')).not.toBeInTheDocument();
  });
});
