import { App } from 'antd';

import { AppError } from '@/shared/errors/AppError';

import type { RoastPlanJsonInput } from '../types';

import { RoastPlanForm } from './RoastPlanForm';

interface RoastPlanManualCreatorProps {
  onCreate: (input: RoastPlanJsonInput) => void;
}

const defaultRoastPlanFormValues: RoastPlanJsonInput = {
  name: '',
  beanName: '',
  batchWeightGrams: 200,
  roastLevel: '手冲浅烘',
  purpose: '手冲',
  steps: [
    {
      time: '0:00',
      event: '入豆',
      operation: '入豆',
      temperature: '235°C',
      firePower: '90%',
    },
    {
      time: '4:40~5:00',
      event: '转黄',
      operation: '降火',
      temperature: '154~158°C',
      firePower: '75%',
    },
    {
      time: '8:50~9:20',
      event: '一爆开始',
      operation: '保持',
      temperature: '208±2°C',
      firePower: '65%',
    },
  ],
};

export function RoastPlanManualCreator({ onCreate }: RoastPlanManualCreatorProps) {
  const { message } = App.useApp();

  const submitForm = (values: RoastPlanJsonInput) => {
    try {
      onCreate(values);
      void message.success('已通过界面创建烘焙计划');
    } catch (error) {
      const errorMessage = error instanceof AppError ? error.message : '创建失败，请检查表单内容。';
      void message.error(errorMessage);
    }
  };

  return (
    <RoastPlanForm
      initialValues={defaultRoastPlanFormValues}
      onSubmit={submitForm}
      resetOnSubmit
      submitLabel="创建烘焙计划"
    />
  );
}
