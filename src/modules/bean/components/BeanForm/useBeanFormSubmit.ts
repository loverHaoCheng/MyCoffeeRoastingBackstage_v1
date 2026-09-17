import { type FieldPath, type UseFormClearErrors, type UseFormSetError, type UseFormSetFocus } from 'react-hook-form';

import { greenBeanCreateFormSchema } from '@/modules/bean/schemas';
import { scrollToField } from '@/shared/forms/scrollToField';
import { beanFormFieldPathMap } from '@/modules/bean/utils/beanForm.utils';
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';

interface UseBeanFormSubmitParams {
  clearErrors: UseFormClearErrors<GreenBeanFormInput>;
  setError: UseFormSetError<GreenBeanFormInput>;
  setFocus: UseFormSetFocus<GreenBeanFormInput>;
  templatePreview: {
    errorMessage: string | null;
    values: { defaultSaleUnitPrice: number; defaultSaleUnitWeightGrams: number } | null;
  };
  onSubmit: (input: GreenBeanFormInput) => Promise<void> | void;
}

export function useBeanFormSubmit({
  clearErrors,
  setError,
  setFocus,
  templatePreview,
  onSubmit,
}: UseBeanFormSubmitParams) {
  return async (values: GreenBeanFormInput) => {
    clearErrors();

    if (templatePreview.errorMessage) {
      setError('costTemplateId', {
        message: templatePreview.errorMessage,
        type: 'manual',
      });
      window.requestAnimationFrame(() => {
        scrollToField('costTemplateId');
      });
      return;
    }

    const result = greenBeanCreateFormSchema.safeParse(values);

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const pathKey = issue.path.join('.');
        const fieldPath = beanFormFieldPathMap[pathKey];

        if (!fieldPath) {
          return;
        }

        setError(fieldPath, {
          message: issue.message,
          type: 'manual',
        });
      });

      const firstFieldPath = result.error.issues
        .map((issue) => beanFormFieldPathMap[issue.path.join('.')])
        .find((fieldPath): fieldPath is FieldPath<GreenBeanFormInput> => fieldPath != null);

      if (firstFieldPath) {
        window.requestAnimationFrame(() => {
          setFocus(firstFieldPath);
        });
      }

      return;
    }

    await onSubmit(result.data);
  };
}
