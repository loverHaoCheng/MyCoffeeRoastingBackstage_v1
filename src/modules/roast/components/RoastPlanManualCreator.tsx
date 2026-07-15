import type { RoastPlanJsonInput } from '../types';

import { RoastPlanForm } from './RoastPlanForm';

interface RoastPlanManualCreatorProps {
  onCancel?: () => void;
  onCreate: (input: RoastPlanJsonInput) => Promise<void> | void;
}

const defaultRoastPlanFormValues: RoastPlanJsonInput = {
  name: '',
  beanName: '',
  roasterModel: '',
  batchWeightGrams: 200,
  roastLevel: '手冲浅烘',
  purpose: '手冲',
  steps: [
    {
      time: '0:00',
      event: '入豆',
      operation: '入豆',
      temperature: '235°C',
      airTemperature: '210°C',
      firePower: '90%',
      drumSpeed: '45rpm',
    },
    {
      time: '4:40~5:00',
      event: '转黄',
      operation: '降火',
      temperature: '154~158°C',
      airTemperature: '165°C',
      firePower: '75%',
      drumSpeed: '47rpm',
    },
    {
      time: '8:50~9:20',
      event: '一爆开始',
      operation: '保持',
      temperature: '208±2°C',
      airTemperature: '196°C',
      firePower: '65%',
      drumSpeed: '50rpm',
    },
  ],
};

export function RoastPlanManualCreator({ onCancel, onCreate }: RoastPlanManualCreatorProps) {
  const submitForm = (values: RoastPlanJsonInput) => {
    void onCreate(values);
  };

  return (
    <RoastPlanForm
      initialValues={defaultRoastPlanFormValues}
      onCancel={onCancel}
      onSubmit={submitForm}
      resetOnSubmit
      submitLabel="创建烘焙计划"
    />
  );
}
