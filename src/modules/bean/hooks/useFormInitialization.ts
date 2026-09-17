import { useEffect } from 'react';
import type { UseFormReset } from 'react-hook-form';

import type { GreenBeanFormInput } from '../types/localGreenBean';

interface UseFormInitializationParams {
  initialValues: GreenBeanFormInput;
  reset: UseFormReset<GreenBeanFormInput>;
  onResetCallbacks: Array<() => void>;
}

export function useFormInitialization({
  initialValues,
  reset,
  onResetCallbacks,
}: UseFormInitializationParams): void {
  useEffect(() => {
    reset(initialValues);
    onResetCallbacks.forEach((callback) => {
      callback();
    });
  }, [initialValues, onResetCallbacks, reset]);
}
