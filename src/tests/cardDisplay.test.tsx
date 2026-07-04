import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BeanInventoryCard } from '@/modules/bean/components/BeanInventoryCard';
import { useSettingsStore } from '@/modules/settings/store';
import { createDefaultAppDisplaySettings } from '@/modules/settings/types';
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
    const labels = Array.from(container.querySelectorAll('dt')).map((node) => node.textContent);

    expect(labels).toEqual(['成本', '库存']);
  });
});
