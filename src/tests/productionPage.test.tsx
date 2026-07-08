import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
} from '@/modules/settings/types';
import { ProductionPage } from '@/modules/production';
import { renderWithQuery } from '@/tests/renderWithProviders';

vi.mock('@/modules/bean/hooks', () => ({
  useBeans: () => ({
    data: [
      {
        id: 'bean-1',
        name: '测试生豆',
        origin: '埃塞俄比亚 · 古吉',
        process: '水洗',
        grade: 'G1',
        stockKg: 12,
        costPerKg: 100,
        createdAt: '2026-07-03T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
      },
    ],
    isFetching: false,
  }),
}));

vi.mock('@/modules/roast/hooks', () => ({
  roastBatchQueryKeys: { all: ['roast-batches'], list: () => ['roast-batches', 'list'] },
  useDeleteRoastBatch: () => ({
    mutateAsync: vi.fn(),
  }),
  useRoastBatches: () => ({
    data: [
      {
        id: 'batch-1',
        roastDate: '2026-07-03T10:00:00.000Z',
        greenBeanId: 'bean-1',
        greenBeanName: '测试生豆',
        roastedBeanName: '测试熟豆',
        roastPlanId: 'plan-1',
        roastPlanName: '测试计划',
        inputWeightGrams: 200,
        outputWeightGrams: 170,
        roastLevel: '手冲浅烘',
        developmentRatio: 18,
        firstCrackTime: 420,
        totalRoastTime: 540,
        notes: '测试备注',
        status: 'completed',
        createdAt: '2026-07-03T10:00:00.000Z',
        updatedAt: '2026-07-03T10:00:00.000Z',
      },
    ],
    isFetching: false,
  }),
  useRoastPlans: () => ({
    data: [
      {
        id: 'plan-1',
        beanId: 'bean-1',
        beanName: '测试生豆',
        batchWeightGrams: 200,
        name: '测试计划',
        plannedBatchKg: 0.2,
        roastPurpose: '手冲',
        status: 'draft',
        steps: [
          {
            id: 1,
            timeLabel: '0:00',
            eventName: '入豆',
            operation: '入豆',
            drumTemperature: '200°C',
            firePower: '80%',
          },
        ],
        targetRoastLevel: '手冲浅烘',
        createdAt: '2026-07-03T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
      },
    ],
    isFetching: false,
  }),
  useUpdateRoastBatch: () => ({
    mutateAsync: vi.fn(),
  }),
}));

describe('ProductionPage (烘焙历史)', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
    });
  });

  it('renders the roast history page with search and FAB', () => {
    renderWithQuery(<ProductionPage />);

    expect(screen.getByLabelText('搜索烘焙历史')).toBeInTheDocument();
  });

  it('opens the full roast batch form from the card level edit button', () => {
    renderWithQuery(<ProductionPage />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 测试熟豆' }));

    expect(screen.getAllByText('编辑烘焙记录').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /保存烘焙记录/ })).toBeInTheDocument();
  });
});
