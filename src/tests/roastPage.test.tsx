import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoastPage } from '@/modules/roast';
import { costTemplateSettingsStorageKey } from '@/modules/settings/services/costTemplateSettings.service';
import { pocketBaseConnectionSettingsStorageKey } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
} from '@/modules/settings/types';
import { renderWithQuery } from '@/tests/renderWithProviders';
import { localGreenBeanStorageKey } from '@/modules/bean/services';

vi.mock('@/modules/bean/hooks', () => ({
  beanEditableDetailQueryKeys: { all: ['bean-editable-detail'] },
  beanQueryKeys: { all: ['bean'] },
  useBeans: () => ({
    data: [
      {
        id: 'local-test-bean-1',
        name: '测试生豆',
        origin: '埃塞俄比亚 · 古吉',
        process: '水洗',
        grade: '74110',
        stockKg: 30,
        costPerKg: 70,
        createdAt: '2026-07-03T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/modules/roast/hooks', () => ({
  roastBatchQueryKeys: { all: ['roast-batches'] },
  roastPlanQueryKeys: { all: ['roast-plans'] },
  useDeleteRoastPlan: () => ({
    mutateAsync: vi.fn(),
  }),
  useRoastBatches: () => ({
    data: [],
    isFetching: false,
  }),
  useRoastPlans: () => ({
    data: [
      {
        beanId: 'bean-1',
        beanName: '肯尼亚 柏拉 AA Plus SL28 SL34 水洗',
        batchWeightGrams: 200,
        createdAt: '2026-07-03T00:00:00.000Z',
        id: 1,
        name: '肯尼亚 柏拉 AA Plus SL28 SL34 水洗',
        plannedBatchKg: 0.2,
        roastPurpose: '手冲',
        status: 'draft',
        steps: [
          {
            drumTemperature: '235°C',
            eventName: '入豆',
            firePower: '90%',
            id: 1,
            operation: '入豆',
            timeLabel: '0:00',
          },
          {
            drumTemperature: '-',
            eventName: '回温点',
            firePower: '90%',
            id: 2,
            operation: '保持',
            timeLabel: '1:20~1:30',
          },
        ],
        targetRoastLevel: '手冲浅烘',
        updatedAt: '2026-07-03T00:00:00.000Z',
      },
      {
        beanId: 'bean-2',
        beanName: '埃塞俄比亚 古吉 水洗',
        batchWeightGrams: 500,
        createdAt: '2026-07-03T00:00:00.000Z',
        id: 2,
        name: '埃塞俄比亚 古吉 水洗 浅中烘',
        plannedBatchKg: 0.5,
        roastPurpose: '意式拼配测试',
        status: 'draft',
        steps: [
          {
            drumTemperature: '220°C',
            eventName: '入豆',
            firePower: '85%',
            id: 1,
            operation: '入豆',
            timeLabel: '0:00',
          },
          {
            drumTemperature: '-',
            eventName: '回温点',
            firePower: '85%',
            id: 2,
            operation: '保持',
            timeLabel: '1:30',
          },
        ],
        targetRoastLevel: '浅中烘',
        updatedAt: '2026-07-03T00:00:00.000Z',
      },
    ],
    isFetching: false,
  }),
  useUpdateRoastPlan: () => ({
    mutateAsync: vi.fn(),
  }),
}));

const getStepTimeValue = (index: number) => {
  const input = document.querySelector<HTMLInputElement>(`input[name="steps.${String(index)}.time"]`);

  expect(input).not.toBeNull();

  if (!input) {
    throw new Error('step time input not found');
  }

  return input.value;
};

const performUiUpdate = async (action: () => void) => {
  await act(async () => {
    action();
    await Promise.resolve();
  });
};

describe('RoastPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
    });

    window.localStorage.setItem(
      pocketBaseConnectionSettingsStorageKey,
      JSON.stringify({
        greenBean: {
          projectUrl: 'https://green-demo.pocketbase.local',
          publishableKey: '',
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
    window.localStorage.setItem(
      localGreenBeanStorageKey,
      JSON.stringify({
        records: [
          {
            id: 'local-test-bean-1',
            source: 'local',
            code: 'GB-TEST-001',
            displayName: '测试生豆',
            variety: '74110',
            processMethod: '水洗',
            originCountry: '埃塞俄比亚',
            originRegion: '古吉',
            originArea: null,
            harvestSeason: '2026',
            moistureRatio: null,
            altitudeMeters: null,
            density: null,
            millName: null,
            notes: null,
            supplierName: '测试供应商',
            purchasedWeightGrams: 30000,
            purchasedTotalPrice: 2100,
            defaultRoastInputGrams: 200,
            defaultSaleUnitPrice: 88,
            defaultSaleUnitWeightGrams: 100,
            finalSaleUnitPrice: 88,
            finalSaleUnitWeightGrams: 100,
            costTemplateId: 'template-1',
            createdAt: '2026-07-03T00:00:00.000Z',
            updatedAt: '2026-07-03T00:00:00.000Z',
          },
        ],
        version: 1,
      }),
    );

    act(() => {
      useSettingsStore.getState().loadPocketBaseConnections();
      useSettingsStore.getState().loadCostTemplates();
    });
  });

  it('renders roast plan cards and opens detail drawer for editing', async () => {
    renderWithQuery(<RoastPage />);

    expect(screen.getByLabelText('烘焙计划列表')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '烘焙计划' })).not.toBeInTheDocument();
    expect(screen.queryByText('Roast Plan')).not.toBeInTheDocument();
    expect(screen.queryByText('按时间、事件、操作、炉温和火力管理烘焙节点，生产时可直接选择计划执行。')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'check-circle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除计划' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: '烘焙计划节点' })).not.toBeInTheDocument();
    expect(screen.getAllByText('2 个节点')).toHaveLength(2);
    expect(screen.queryByText('计划数量')).not.toBeInTheDocument();
    expect(screen.queryByText('PLANS')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看 肯尼亚/ })).toBeInTheDocument();

    const editStepButtons = screen.getAllByRole('button', { name: '修改 节点数' });
    const firstEditStepButton = editStepButtons[0];

    if (!firstEditStepButton) {
      throw new Error('edit step button not found');
    }

    await performUiUpdate(() => {
      fireEvent.click(firstEditStepButton);
    });

    expect(screen.getByText('编辑烘焙计划')).toBeInTheDocument();
    expect(screen.queryByText('肯尼亚 柏拉 AA Plus SL28 SL34 水洗（200g，手冲浅烘）')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '生豆' })).toBeInTheDocument();
    expect(screen.queryByLabelText('生豆名称')).not.toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: '保存计划' });

    expect(screen.getByText('烘焙节点')).toBeInTheDocument();
    expect(screen.getAllByText('火力')[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上移节点 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下移节点 2' })).toBeDisabled();

    expect(getStepTimeValue(0)).toBe('0:00');

    await performUiUpdate(() => {
      fireEvent.click(screen.getByRole('button', { name: '下移节点 1' }));
    });

    expect(getStepTimeValue(0)).toBe('1:20~1:30');

    await performUiUpdate(() => {
      fireEvent.click(screen.getByRole('button', { name: '上移节点 2' }));
    });

    expect(getStepTimeValue(0)).toBe('0:00');

    await performUiUpdate(() => {
      fireEvent.change(screen.getByPlaceholderText('例如 肯尼亚 柏拉 AA Plus 水洗'), {
        target: { value: '更新后的肯尼亚测试计划' },
      });
    });
    await performUiUpdate(() => {
      fireEvent.click(screen.getByRole('button', { name: '添加节点' }));
    });

    expect(screen.getByText('节点 3')).toBeInTheDocument();

    await performUiUpdate(() => {
      fireEvent.click(screen.getByRole('button', { name: '删除节点 3' }));
    });

    expect(screen.queryByText('节点 3')).not.toBeInTheDocument();

    await performUiUpdate(() => {
      fireEvent.click(saveButton);
    });
  });

  it('opens a read-only detail drawer for viewing', () => {
    renderWithQuery(<RoastPage />);

    fireEvent.click(screen.getByRole('button', { name: /查看 埃塞俄比亚/ }));

    expect(screen.getByText('烘焙计划详情')).toBeInTheDocument();
    expect(screen.getByText('计划名称')).toBeInTheDocument();
    expect(screen.getByText('烘焙节点')).toBeInTheDocument();
    expect(screen.queryByLabelText('计划名称')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存计划' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除计划' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '添加节点' })).not.toBeInTheDocument();
  });

  it('opens the full roast plan form from the card level edit button', () => {
    renderWithQuery(<RoastPage />);

    fireEvent.click(screen.getByRole('button', { name: '全部编辑 肯尼亚 柏拉 AA Plus SL28 SL34 水洗' }));

    expect(screen.getByText('编辑烘焙计划')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存计划' })).toBeInTheDocument();
  });

  it('renders the roast history workspace shell', () => {
    renderWithQuery(<RoastPage />);

    expect(screen.getByLabelText('烘焙计划搜索')).toBeInTheDocument();
    expect(screen.getByLabelText('烘焙计划卡片区域')).toBeInTheDocument();
  });
});
