import App from 'antd/es/app';
import { useMemo } from 'react';

import { createDefaultBeanFormValues } from '@/modules/bean/constants';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { AppError } from '@/shared/errors/AppError';

import type { GreenBeanCreateInput } from '../types/localGreenBean';

import { BeanForm } from './BeanForm';

interface BeanManualCreatorProps {
  initialValues?: GreenBeanCreateInput;
  onCancel?: () => void;
  onCreate: (input: GreenBeanCreateInput) => Promise<void> | void;
}

export function BeanManualCreator({ initialValues, onCancel, onCreate }: BeanManualCreatorProps) {
  const { message } = App.useApp();
  const { costTemplateSettings } = useCostTemplateSettings();
  const defaultBeanFormValues = useMemo(() => initialValues ?? createDefaultBeanFormValues(), [initialValues]);

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
