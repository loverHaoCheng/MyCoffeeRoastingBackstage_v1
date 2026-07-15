import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemo, useState, type ReactNode } from 'react';

import { BeanPage } from '@/modules/bean';
import { createDefaultBeanCode } from '@/modules/bean/constants';
import { beanAiRecognitionService, beanCacheService, beanService } from '@/modules/bean/services';
import { useSettingsStore } from '@/modules/settings/store';
import { FloatingActionRegistrationContext, type ViewportFloatingActionButtonProps } from '@/shared/components/ViewportFloatingActionButton.context';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
} from '@/modules/settings/types';
import { renderWithQuery } from '@/tests/renderWithProviders';

function FloatingActionTestHost({ children }: { children: ReactNode }) {
  const [actionConfig, setActionConfig] = useState<ViewportFloatingActionButtonProps | null>(null);
  const contextValue = useMemo(() => ({
    enabled: true,
    register(config: ViewportFloatingActionButtonProps) {
      setActionConfig(config);

      return () => {
        setActionConfig(null);
      };
    },
  }), []);

  return (
    <FloatingActionRegistrationContext.Provider value={contextValue}>
      {children}
      {actionConfig ? (
        <button aria-label={actionConfig.ariaLabel} onClick={actionConfig.onClick} type="button">
          {actionConfig.ariaLabel}
        </button>
      ) : null}
    </FloatingActionRegistrationContext.Provider>
  );
}

describe('BeanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    beanCacheService.clear();
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
    });
  });

  const stubBeanQueries = (beans: ReturnType<typeof createBeanRecords>): void => {
    vi.spyOn(beanService, 'getBootstrappedBeans').mockReturnValue(beans);
    vi.spyOn(beanService, 'listBeans').mockResolvedValue({
      code: 0,
      data: beans,
      message: 'ok',
    });
  };

  const createBeanRecords = (stockKg = 1) => [
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
  ];

  const saveBeanCache = (stockKg: number): void => {
    const beans = createBeanRecords(stockKg);
    beanCacheService.save(beans, 'mock');
    stubBeanQueries(beans);
  };

  const saveBeanSummaryCache = (): void => {
    const beans = [
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
    ];
    beanCacheService.save(beans, 'mock');
    stubBeanQueries(beans);
  };

  const enableBeanCreationPrerequisites = (): void => {
    useSettingsStore.setState({
      costTemplateSettings: {
        defaultTemplateId: 'template-1',
        templates: [
          {
            createdAt: '2026-07-10T00:00:00.000Z',
            dehydrationRate: 14,
            energyCost: 1,
            id: 'template-1',
            laborCost: 4,
            name: '默认模板',
            notes: '',
            otherCost: 0,
            packagingCost: 1,
            roastInputWeightGrams: 200,
            saleUnitWeightGrams: 160,
            targetProfitRate: 30,
            updatedAt: '2026-07-10T00:00:00.000Z',
          },
        ],
        updatedAt: null,
      },
    });
  };

  it('formats the default bean code with two digit date and time parts', () => {
    expect(createDefaultBeanCode(new Date('2026-07-09T21:08:00.000Z'))).toBe('EB-2607100508');
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
    renderWithQuery(<BeanPage />);

    expect(await screen.findByText('没有匹配的生豆批次')).toBeInTheDocument();
    expect(screen.getByLabelText('生豆库存筛选')).toBeInTheDocument();
  });

  it('keeps the empty state visible after deleting the last bean during a background refresh', async () => {
    saveBeanCache(1);
    const pendingListRequest = new Promise<never>(() => undefined);
    vi.spyOn(beanService, 'getBootstrappedBeans').mockReturnValue(createBeanRecords(1));
    vi.spyOn(beanService, 'listBeans').mockReturnValue(pendingListRequest);
    const deleteBeanSpy = vi.spyOn(beanService, 'deleteBean').mockResolvedValue({ queued: false, synced: true });

    renderWithQuery(<BeanPage />);

    fireEvent.click(await screen.findByRole('button', { name: '删除 零库存测试豆' }));

    const deleteDialog = await screen.findByRole('dialog', { name: '确认删除' });
    const deleteButton = within(deleteDialog).getByRole('button', { name: '删 除' });

    expect(deleteButton).toBeDisabled();

    fireEvent.click(within(deleteDialog).getByRole('radio', { name: /全部改为通用计划/ }));
    expect(deleteButton).toBeEnabled();
    fireEvent.click(within(deleteDialog).getByRole('button', { name: '删 除' }));

    await waitFor(() => {
      expect(deleteBeanSpy).toHaveBeenCalledWith('bean-zero-stock', 'makeGeneric');
    });

    await waitFor(() => {
      expect(screen.getByText('没有匹配的生豆批次')).toBeInTheDocument();
    });
  });

  it('opens a create method action sheet before showing the bean creator', async () => {
    enableBeanCreationPrerequisites();
    useSettingsStore.setState((state) => ({
      pocketBaseConnections: {
        ...state.pocketBaseConnections,
        greenBean: {
          projectUrl: '',
          publishableKey: '',
        },
      },
    }));
    vi.spyOn(beanAiRecognitionService, 'getUsage').mockResolvedValue({
      enabled: true,
      monthlyLimit: 10,
      remainingUses: 3,
      usedThisMonth: 7,
    });

    renderWithQuery(
      <FloatingActionTestHost>
        <BeanPage />
      </FloatingActionTestHost>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '新增生豆' }));

    const createMethodDialog = await screen.findByRole('dialog', { name: '选择创建方式' });

    expect(within(createMethodDialog).getByRole('button', { name: '手动创建' })).toBeInTheDocument();
    expect(within(createMethodDialog).getByRole('button', { name: 'AI 图片识别' })).toBeInTheDocument();
    expect(await within(createMethodDialog).findByText('本月剩余 3 / 10')).toBeInTheDocument();
    expect(within(createMethodDialog).getByRole('button', { name: '取消' })).toBeInTheDocument();

    fireEvent.click(within(createMethodDialog).getByRole('button', { name: 'AI 图片识别' }));

    expect(await screen.findByText('上传袋标、采购单或生豆标签')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '手动创建' })).not.toBeInTheDocument();
  });

  it('disables AI image recognition from the create method sheet when quota is exhausted', async () => {
    enableBeanCreationPrerequisites();
    vi.spyOn(beanAiRecognitionService, 'getUsage').mockResolvedValue({
      enabled: true,
      monthlyLimit: 10,
      remainingUses: 0,
      usedThisMonth: 10,
    });

    renderWithQuery(
      <FloatingActionTestHost>
        <BeanPage />
      </FloatingActionTestHost>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '新增生豆' }));

    const createMethodDialog = await screen.findByRole('dialog', { name: '选择创建方式' });
    const aiRecognitionButton = within(createMethodDialog).getByRole('button', { name: 'AI 图片识别' });

    expect(await within(createMethodDialog).findByText('本月剩余 0 / 10')).toBeInTheDocument();
    expect(aiRecognitionButton).toBeDisabled();
  });

  it('shows the server reason when AI recognition quota loading fails', async () => {
    enableBeanCreationPrerequisites();
    vi.spyOn(beanAiRecognitionService, 'getUsage').mockRejectedValue(new Error('ai_usage_limits 字段配置错误'));

    renderWithQuery(
      <FloatingActionTestHost>
        <BeanPage />
      </FloatingActionTestHost>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '新增生豆' }));

    const createMethodDialog = await screen.findByRole('dialog', { name: '选择创建方式' });
    const aiRecognitionButton = within(createMethodDialog).getByRole('button', { name: 'AI 图片识别' });

    expect(await within(createMethodDialog).findByText('额度读取失败：ai_usage_limits 字段配置错误')).toBeInTheDocument();
    expect(aiRecognitionButton).toBeDisabled();
  });

  it('puts zero-stock beans into a collapsed bottom section and removes them after stock changes', async () => {
    saveBeanCache(0);

    const firstRender = renderWithQuery(<BeanPage />);

    const collapsedSection = await screen.findByLabelText('零库存生豆折叠区');
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
    expect(await screen.findByText('零库存测试豆')).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: '全部编辑 测试豆 A' }));

    expect(await screen.findByText('编辑生豆')).toBeInTheDocument();
  });

  it('matches flavor tags with fuzzy keyword search', async () => {
    saveBeanSummaryCache();

    renderWithQuery(<BeanPage />);

    await screen.findByText('测试豆 A');

    fireEvent.change(screen.getByLabelText('搜索生豆'), {
      target: { value: '柑' },
    });

    expect(await screen.findByText('测试豆 A')).toBeInTheDocument();
    expect(screen.queryByText('测试豆 B')).not.toBeInTheDocument();
  });
});
