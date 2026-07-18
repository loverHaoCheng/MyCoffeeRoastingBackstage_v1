import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BeanInventoryCard } from '@/modules/bean/components/BeanInventoryCard';
import { cardDisplayModules } from '@/modules/settings/constants/cardDisplayModules';
import { useSettingsStore } from '@/modules/settings/store';
import { UnifiedDataCard } from '@/shared/components/UnifiedDataCard';
import { createDefaultAppDisplaySettings, createDefaultCostTemplateSettings } from '@/modules/settings/types';
import type { Bean } from '@/types/domain';

const createBean = (): Bean => ({
  agingDays: 14,
  costPerKg: 86,
  createdAt: '2026-06-28T10:00:00.000Z',
  grade: 'G1',
  id: 1,
  name: '测试生豆',
  origin: '埃塞俄比亚 · 古吉',
  process: '水洗',
  purchasedWeightGrams: 25000,
  remainingWeightGrams: 12500,
  stockKg: 12.5,
  supplierName: '示例供应商',
  tastingEndDays: 40,
  variety: '74110',
  updatedAt: '2026-06-28T10:00:00.000Z',
});

describe('card display settings', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
    });
  });

  it('hides meta items when the display count is zero', () => {
    const nextSettings = createDefaultAppDisplaySettings();
    nextSettings.cardDisplaySettings.beanInventory = {
      displayCount: 0,
      visibleMetaKeys: [],
    };
    useSettingsStore.setState({ appDisplaySettings: nextSettings });

    const { container } = render(<BeanInventoryCard bean={createBean()} />);

    expect(container.querySelectorAll('dt')).toHaveLength(0);
  });

  it('renders meta items in the configured order', () => {
    const nextSettings = createDefaultAppDisplaySettings();
    nextSettings.cardDisplaySettings.beanInventory = {
      displayCount: 2,
      visibleMetaKeys: ['cost', 'stock'],
    };
    useSettingsStore.setState({ appDisplaySettings: nextSettings });

    const { container } = render(<BeanInventoryCard bean={createBean()} />);
    const content = container.textContent;

    expect(content.indexOf('成本')).toBeGreaterThanOrEqual(0);
    expect(content.indexOf('库存')).toBeGreaterThanOrEqual(0);
    expect(content.indexOf('成本')).toBeLessThan(content.indexOf('库存'));
  });

  it('renders the selected cost template when the card shows that field', () => {
    const nextSettings = createDefaultAppDisplaySettings();
    nextSettings.cardDisplaySettings.beanInventory = {
      displayCount: 2,
      visibleMetaKeys: ['costTemplateId', 'stock'],
    };
    useSettingsStore.setState({
      appDisplaySettings: nextSettings,
      costTemplateSettings: {
        defaultTemplateId: 'template-1',
        templates: [
          {
            createdAt: '2026-06-28T00:00:00.000Z',
            dehydrationRate: 14,
            energyCost: 0,
            id: 'template-1',
            laborCost: 0,
            name: '轻度成本模板',
            notes: '',
            otherCost: 0,
            packagingCost: 0,
            roastInputWeightGrams: 200,
            saleUnitWeightGrams: 100,
            targetProfitRate: 30,
            updatedAt: '2026-06-28T00:00:00.000Z',
          },
        ],
        updatedAt: '2026-06-28T00:00:00.000Z',
      },
    });

    render(<BeanInventoryCard bean={{ ...createBean(), costTemplateId: 'template-1' }} />);

    expect(screen.getByText('成本模板')).toBeInTheDocument();
    expect(screen.getByText('轻度成本模板')).toBeInTheDocument();
  });

  it('shows the bean variety in the card subtitle', () => {
    render(<BeanInventoryCard bean={createBean()} />);

    expect(screen.getByText('豆种 74110')).toBeInTheDocument();
    expect(screen.queryByText(/编号 EB-/)).not.toBeInTheDocument();
  });

  it('shows the inventory ratio footer on bean cards', () => {
    const { container } = render(<BeanInventoryCard bean={createBean()} />);

    expect(screen.getByText('总库存 25 kg · 剩余库存 12.5 kg')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '测试生豆 剩余库存占比' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('50%')).toBeInTheDocument();

    const footer = container.querySelector('[aria-label="测试生豆 剩余库存占比"]')?.parentElement;

    expect(footer).not.toBeNull();
    expect(footer).toHaveClass('border-0');
  });

  it('treats non-positive quality metrics as missing values', () => {
    const nextSettings = createDefaultAppDisplaySettings();
    nextSettings.cardDisplaySettings.beanInventory = {
      displayCount: 4,
      visibleMetaKeys: ['altitudeMetersMin', 'altitudeMetersMax', 'moisturePercent', 'densityGPerL'],
    };
    useSettingsStore.setState({ appDisplaySettings: nextSettings });

    render(
      <BeanInventoryCard
        bean={{
          ...createBean(),
          altitudeMetersMax: 0,
          altitudeMetersMin: 0,
          densityGPerL: 0,
          moisturePercent: 0,
        }}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('海拔下限')).toBeInTheDocument();
    expect(screen.getByText('海拔上限')).toBeInTheDocument();
    expect(screen.getByText('含水率')).toBeInTheDocument();
    expect(screen.getByText('密度')).toBeInTheDocument();
    expect(screen.getAllByText('待补充')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: '修改 海拔下限' })).not.toBeInTheDocument();
  });

  it('shows all editable fields for newly created local beans', () => {
    const nextSettings = createDefaultAppDisplaySettings();
    nextSettings.cardDisplaySettings.beanInventory = {
      displayCount: 0,
      visibleMetaKeys: [],
    };
    useSettingsStore.setState({ appDisplaySettings: nextSettings });

    const { container } = render(
      <BeanInventoryCard
        bean={{
          ...createBean(),
          id: 'local-test-bean-1',
        }}
      />,
    );

    expect(screen.getByText('默认烘焙量')).toBeInTheDocument();
    expect(screen.getByText('默认单份售价')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '展开' })).not.toBeInTheDocument();
    expect(container.textContent).toContain('默认单份重量');
  });

  it('renders detail rows directly without an expand action', () => {
    render(
      <UnifiedDataCard
        metaItems={Array.from({ length: 10 }, (_, index) => ({
          key: `field-${String(index + 1)}`,
          label: `字段 ${String(index + 1)}`,
          value: `值 ${String(index + 1)}`,
        }))}
        title="测试卡片"
      />,
    );

    expect(screen.queryByRole('button', { name: '展开' })).not.toBeInTheDocument();
    expect(screen.queryByText('字段 10')).not.toBeInTheDocument();
  });

  it('wires the full edit button to the card callback', () => {
    const onEditAll = vi.fn();

    render(<BeanInventoryCard bean={createBean()} onEditAll={onEditAll} />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 测试生豆' }));

    expect(onEditAll).toHaveBeenCalledWith(1);
  });

  it('wires the view action to the card callback', () => {
    const onView = vi.fn();

    render(<BeanInventoryCard bean={createBean()} onView={onView} />);

    fireEvent.click(screen.getByRole('button', { name: '查看 测试生豆' }));

    expect(onView).toHaveBeenCalledWith(1);
  });

  it('does not expose the computed cost row as an editable field', () => {
    const onEdit = vi.fn();
    const nextSettings = createDefaultAppDisplaySettings();
    nextSettings.cardDisplaySettings.beanInventory = {
      displayCount: 2,
      visibleMetaKeys: ['cost', 'stock'],
    };
    useSettingsStore.setState({ appDisplaySettings: nextSettings });

    render(<BeanInventoryCard bean={createBean()} onEdit={onEdit} />);

    expect(screen.queryByRole('button', { name: '修改 成本' })).not.toBeInTheDocument();
  });

  it('keeps card row labels on one line when the value is multiline', () => {
    render(
      <UnifiedDataCard
        metaItems={[
          {
            key: 'bean',
            label: '生豆',
            multiline: true,
            value: '埃塞俄比亚 Alo Main Station 74158 日晒 Lot.3 空运批次',
          },
        ]}
        previewMetaItems={[
          {
            key: 'bean',
            label: '生豆',
            multiline: true,
            value: '埃塞俄比亚 Alo Main Station 74158 日晒 Lot.3 空运批次',
          },
        ]}
        title="日晒"
      />,
    );

    const label = screen.getByText('生豆');
    const row = label.closest('button, div');

    expect(label).toHaveClass('whitespace-nowrap');
    expect(label).toHaveClass('truncate');
    expect(row).not.toBeNull();
  });

  it('renders preview fields as read-only rows separated by dividers', () => {
    render(
      <BeanInventoryCard
        bean={createBean()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('库存')).toBeInTheDocument();
    expect(screen.getByText('12.5 kg')).toBeInTheDocument();
    expect(screen.getByText('成本')).toBeInTheDocument();
    expect(screen.getByText('¥86 / kg')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '修改 库存' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '修改 处理法' })).not.toBeInTheDocument();
  });

  it('keeps settings card-display modules aligned with the actual card fields and page names', () => {
    const roastHistoryModule = cardDisplayModules.find((module) => module.key === 'roastBatch');
    const roastPlanModule = cardDisplayModules.find((module) => module.key === 'roastPlan');

    expect(roastHistoryModule).toMatchObject({
      description: '烘焙历史卡片',
      label: '烘焙历史',
    });
    expect(roastHistoryModule?.metaOptions.some((option) => option.key === 'salesMode')).toBe(true);
    expect(roastPlanModule?.metaOptions.some((option) => option.key === 'roasterModel')).toBe(true);
  });
});
