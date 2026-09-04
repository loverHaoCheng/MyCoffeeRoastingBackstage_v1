import App from 'antd/es/app';
import { useMemo } from 'react';

import { createDefaultBeanFormValues } from '@/modules/bean/constants';
import { AppError } from '@/shared/errors/AppError';

import type { GreenBeanCreateInput } from '../types/localGreenBean';

import { BeanForm } from './BeanForm';

interface BeanManualCreatorProps {
  formId?: string;
  initialValues?: GreenBeanCreateInput;
  onCancel?: () => void;
  onCreate: (input: GreenBeanCreateInput) => Promise<void> | void;
}

export function BeanManualCreator({ formId, initialValues, onCancel, onCreate }: BeanManualCreatorProps) {
  const { message } = App.useApp();
  const defaultBeanFormValues = useMemo(() => initialValues ?? createDefaultBeanFormValues(), [initialValues]);

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
      formId={formId}
      onCancel={onCancel}
      onSubmit={submitForm}
      resetOnSubmit
      showBottomActions={false}
      submitLabel="创建生豆"
    />
  );
}
