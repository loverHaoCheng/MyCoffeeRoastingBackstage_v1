import { App } from 'antd';

import { AppError } from '@/shared/errors/AppError';

import type { GreenBeanCreateInput } from '../types/localGreenBean';

import { BeanForm } from './BeanForm';

interface BeanManualCreatorProps {
  onCreate: (input: GreenBeanCreateInput) => Promise<void> | void;
}

const defaultBeanFormValues: GreenBeanCreateInput = {
  code: '',
  defaultRoastInputGrams: 200,
  defaultSaleUnitPrice: 0,
  defaultSaleUnitWeightGrams: 100,
  displayName: '',
  harvestSeason: '',
  millName: '',
  notes: '',
  originArea: '',
  originCountry: '',
  originRegion: '',
  processMethod: '',
  purchasedTotalPrice: 0,
  purchasedWeightGrams: 1000,
  supplierName: '',
  variety: '',
  altitudeMetersMax: null,
  altitudeMetersMin: null,
  densityGPerL: null,
  moisturePercent: null,
};

export function BeanManualCreator({ onCreate }: BeanManualCreatorProps) {
  const { message } = App.useApp();

  const submitForm = async (values: GreenBeanCreateInput) => {
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
      onSubmit={submitForm}
      resetOnSubmit
      submitLabel="创建生豆"
    />
  );
}
