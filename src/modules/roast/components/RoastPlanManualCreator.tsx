import { defaultRoastPlanFormValues } from '@/modules/roast/constants';

import type { RoastPlanJsonInput } from '../types';

import { RoastPlanForm } from './RoastPlanForm';

interface RoastPlanManualCreatorProps {
  initialValues?: RoastPlanJsonInput;
  onCancel?: () => void;
  onCreate: (input: RoastPlanJsonInput) => Promise<void> | void;
}

export function RoastPlanManualCreator({
  initialValues = defaultRoastPlanFormValues,
  onCancel,
  onCreate,
}: RoastPlanManualCreatorProps) {
  const submitForm = (values: RoastPlanJsonInput) => {
    void onCreate(values);
  };

  return (
    <RoastPlanForm
      initialValues={initialValues}
      onCancel={onCancel}
      onSubmit={submitForm}
      resetOnSubmit
      submitLabel="创建烘焙计划"
    />
  );
}
