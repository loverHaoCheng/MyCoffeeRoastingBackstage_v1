import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BeanInventoryCard } from '@/modules/bean/components/BeanInventoryCard';
import { useSettingsStore } from '@/modules/settings/store';
import { createDefaultAppDisplaySettings, createDefaultCostTemplateSettings } from '@/modules/settings/types';
import type { Bean } from '@/types/domain';

const createBean = (): Bean => ({
  costPerKg: 86,
  createdAt: '2026-06-28T10:00:00.000Z',
  grade: 'G1',
  id: 1,
  name: '测试生豆',
  origin: '埃塞俄比亚 · 古吉',
  process: '水洗',
  stockKg: 12.5,
  supplierName: '示例供应商',
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

  it('wires the full edit button to the card callback', () => {
    const onEditAll = vi.fn();

    render(<BeanInventoryCard bean={createBean()} onEditAll={onEditAll} />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 测试生豆' }));

    expect(onEditAll).toHaveBeenCalledWith(1);
  });
});
