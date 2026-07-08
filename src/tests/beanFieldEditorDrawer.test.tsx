import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BeanFieldEditorDrawer } from '@/modules/bean/components';
import { beanService } from '@/modules/bean/services';
import { useSettingsStore } from '@/modules/settings/store';
import { createDefaultAppDisplaySettings, createDefaultCostTemplateSettings } from '@/modules/settings/types';
import { renderWithQuery } from '@/tests/renderWithProviders';
import type { ApiResponse } from '@/services/api.types';
import type { GreenBeanEditableDetail } from '@/modules/bean/types';
import type { Bean } from '@/types/domain';

const createBean = (): Bean => ({
  code: 'GB-001',
  costPerKg: 86,
  createdAt: '2026-07-03T00:00:00.000Z',
  defaultRoastInputGrams: 200,
  defaultSaleUnitPrice: 48,
  defaultSaleUnitWeightGrams: 250,
  grade: '74110',
  harvestSeason: '2025/26',
  id: 'bean-1',
  name: '测试生豆',
  origin: '埃塞俄比亚 · 古吉',
  process: '水洗',
  stockKg: 12.5,
  supplierName: '示例供应商',
  updatedAt: '2026-07-03T00:00:00.000Z',
  variety: '74110',
});

describe('BeanFieldEditorDrawer', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the original purchase total when only editing supplier from fallback data', async () => {
    const bean = createBean();
    const getEditableBeanSpy = vi
      .spyOn(beanService, 'getEditableBean')
      .mockReturnValue(new Promise<ApiResponse<GreenBeanEditableDetail>>(() => undefined));
    const updateBeanSpy = vi.spyOn(beanService, 'updateBean').mockResolvedValue({
      code: 0,
      data: {
        ...bean,
        supplierName: '新供应商',
      },
      message: 'ok',
    });

    renderWithQuery(
      <BeanFieldEditorDrawer
        bean={bean}
        fieldPath="supplierName"
        onClose={() => undefined}
        open
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '新供应商' } });
    fireEvent.click(screen.getByRole('button', { name: /保存供应商/ }));

    await waitFor(() => {
      expect(updateBeanSpy).toHaveBeenCalledTimes(1);
    });

    expect(getEditableBeanSpy).toHaveBeenCalledWith(bean.id);
    expect(updateBeanSpy).toHaveBeenCalledWith(
      bean.id,
      expect.objectContaining({
        purchasedTotalPrice: 1075,
        purchasedWeightGrams: 12500,
        supplierName: '新供应商',
      }),
    );
  });

  it('updates the selected cost template from the field editor drawer', async () => {
    const bean = createBean();
    const getEditableBeanSpy = vi
      .spyOn(beanService, 'getEditableBean')
      .mockReturnValue(new Promise<ApiResponse<GreenBeanEditableDetail>>(() => undefined));
    const updateBeanSpy = vi.spyOn(beanService, 'updateBean').mockResolvedValue({
      code: 0,
      data: {
        ...bean,
        costTemplateId: 'template-1',
      },
      message: 'ok',
    });

    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: {
        defaultTemplateId: 'template-1',
        templates: [
          {
            createdAt: '2026-07-03T00:00:00.000Z',
            dehydrationRate: 14,
            energyCost: 0,
            id: 'template-1',
            laborCost: 0,
            name: '标准模板',
            notes: '',
            otherCost: 0,
            packagingCost: 0,
            roastInputWeightGrams: 200,
            saleUnitWeightGrams: 100,
            targetProfitRate: 30,
            updatedAt: '2026-07-03T00:00:00.000Z',
          },
        ],
        updatedAt: '2026-07-03T00:00:00.000Z',
      },
    });

    renderWithQuery(
      <BeanFieldEditorDrawer bean={bean} fieldPath="costTemplateId" onClose={() => undefined} open />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('标准模板'));
    fireEvent.click(screen.getByRole('button', { name: /保存成本模板/ }));

    await waitFor(() => {
      expect(updateBeanSpy).toHaveBeenCalledTimes(1);
    });

    expect(getEditableBeanSpy).toHaveBeenCalledWith(bean.id);
    expect(updateBeanSpy).toHaveBeenCalledWith(
      bean.id,
      expect.objectContaining({
        costTemplateId: 'template-1',
        purchasedTotalPrice: 1075,
        purchasedWeightGrams: 12500,
      }),
    );
  });
});
