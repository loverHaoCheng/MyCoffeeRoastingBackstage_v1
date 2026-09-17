import { useEffect } from 'react';
import type { FieldPath, FieldValues, UseFormSetFocus } from 'react-hook-form';

import { scrollToField } from '@/shared/forms/scrollToField';

export function useFormFieldFocus<T extends FieldValues>(
  focusFieldPath: FieldPath<T> | undefined,
  setFocus: UseFormSetFocus<T>,
): void {
  useEffect(() => {
    if (!focusFieldPath) {
      return;
    }

    window.requestAnimationFrame(() => {
      scrollToField(focusFieldPath);
      setFocus(focusFieldPath);
    });
  }, [focusFieldPath, setFocus]);
}
