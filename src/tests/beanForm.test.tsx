import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BeanForm } from '@/modules/bean/components/BeanForm';
import { createDefaultBeanFormValues } from '@/modules/bean/constants';
import { greenBeanCreateFormSchema } from '@/modules/bean/schemas';
import { useSettingsStore } from '@/modules/settings/store';
import { createDefaultAppDisplaySettings } from '@/modules/settings/types';
import { renderWithQuery } from '@/tests/renderWithProviders';

describe('BeanForm', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
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
  });

  it('does not refill template price after the user clears the auto-filled final price', async () => {
    renderWithQuery(
      <BeanForm
        autoApplyDefaultCostTemplate
        enableCostTemplateSelection
        initialValues={{
          ...createDefaultBeanFormValues(),
          displayName: '测试生豆',
          processMethod: '水洗',
          variety: 'Heirloom',
        }}
        onSubmit={vi.fn()}
        submitLabel="创建生豆"
      />,
    );

    const purchaseTotalInput = screen.getByRole('spinbutton', { name: '购买总价' });
    const finalPriceInput = screen.getByRole('spinbutton', { name: '最终定价' });

    await waitFor(() => {
      expect(finalPriceInput).toHaveValue('7.25');
    });

    fireEvent.change(purchaseTotalInput, { target: { value: '100' } });

    await waitFor(() => {
      expect(finalPriceInput).toHaveValue('31.45');
    });

    fireEvent.change(finalPriceInput, { target: { value: '' } });

    await waitFor(() => {
      expect(finalPriceInput).toHaveValue('0.00');
    });

    fireEvent.change(purchaseTotalInput, { target: { value: '200' } });

    await waitFor(() => {
      expect(finalPriceInput).toHaveValue('0.00');
    });
  });

  it('renders every split field section from one form coordinator', () => {
    renderWithQuery(
      <BeanForm
        initialValues={createDefaultBeanFormValues()}
        onSubmit={vi.fn()}
        submitLabel="创建生豆"
      />,
    );

    ['基础信息', '烘焙后处理', '产地与品质', '采购与定价', '补充说明'].forEach((heading) => {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    });
    expect(screen.getByRole('textbox', { name: '显示名称' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '含水率' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '备注' })).toBeInTheDocument();
  });

  it('requires positive quality metrics while allowing them to remain empty', () => {
    const validInput = {
      ...createDefaultBeanFormValues(),
      defaultSaleUnitPrice: 20,
      defaultSaleUnitWeightGrams: 100,
      displayName: '测试生豆',
      processMethod: '水洗',
      purchasedTotalPrice: 100,
      variety: 'Heirloom',
    };

    expect(greenBeanCreateFormSchema.safeParse(validInput).success).toBe(true);
    expect(
      greenBeanCreateFormSchema.safeParse({
        ...validInput,
        altitudeMetersMax: 0,
        altitudeMetersMin: 0,
        densityGPerL: 0,
        moisturePercent: 0,
      }).success,
    ).toBe(false);
  });
});
