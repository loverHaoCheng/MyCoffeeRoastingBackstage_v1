import { App } from 'antd';

import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { AppError } from '@/shared/errors/AppError';

import type { GreenBeanCreateInput } from '../types/localGreenBean';

import { BeanForm } from './BeanForm';

interface BeanManualCreatorProps {
  onCancel?: () => void;
  onCreate: (input: GreenBeanCreateInput) => Promise<void> | void;
}

const defaultBeanFormValues: GreenBeanCreateInput = {
  agingDays: 14,
  costTemplateId: null,
  code: '',
  defaultRoastInputGrams: 200,
  defaultSaleUnitPrice: 0,
  defaultSaleUnitWeightGrams: null,
  displayName: '',
  flavorTags: [],
  grade: '',
  harvestSeason: '',
  millName: '',
  notes: '',
  originArea: '',
  originCountry: '',
  originRegion: '',
  processMethod: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  purchasedTotalPrice: 0,
  purchasedWeightGrams: 1000,
  remainingWeightGrams: 1000,
  supplierName: '',
  tastingEndDays: 40,
  variety: '',
  altitudeMetersMax: null,
  altitudeMetersMin: null,
  densityGPerL: null,
  moisturePercent: null,
};

export function BeanManualCreator({ onCancel, onCreate }: BeanManualCreatorProps) {
  const { message } = App.useApp();
  const { costTemplateSettings } = useCostTemplateSettings();

  const submitForm = async (values: GreenBeanCreateInput) => {
    if (costTemplateSettings.templates.length === 0) {
      void message.warning('请先在设置页创建成本模板，再新增生豆。');
      return;
    }

    try {
      await onCreate(values);
    } catch (error) {
      const errorMessage = error instanceof AppError ? error.message : '创建失败，请检查表单内容后重试。';
      void message.error(errorMessage);
    }
  };

  return (
    <BeanForm
      autoApplyDefaultCostTemplate
      enableCostTemplateSelection
      initialValues={defaultBeanFormValues}
      onCancel={onCancel}
      onSubmit={submitForm}
      resetOnSubmit
      submitLabel="创建生豆"
    />
  );
}
