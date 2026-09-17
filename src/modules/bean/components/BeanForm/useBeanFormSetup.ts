import { useForm } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';

import { useCostTemplateSettings } from '@/modules/settings/hooks';
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';
import { useCostTemplateSync } from '@/modules/bean/hooks/useCostTemplateSync';
import { useFormFieldFocus } from '@/modules/bean/hooks/useFormFieldFocus';
import { useFormInitialization } from '@/modules/bean/hooks/useFormInitialization';
import { useRemainingWeightSync } from '@/modules/bean/hooks/useRemainingWeightSync';
import { useSaleDefaultsAutoSync } from '@/modules/bean/hooks/useSaleDefaultsAutoSync';

interface UseBeanFormSetupParams {
  initialValues: GreenBeanFormInput;
  focusFieldPath?: FieldPath<GreenBeanFormInput>;
  autoApplyDefaultCostTemplate: boolean;
  enableCostTemplateSelection: boolean;
}

export function useBeanFormSetup({
  initialValues,
  focusFieldPath,
  autoApplyDefaultCostTemplate,
  enableCostTemplateSelection,
}: UseBeanFormSetupParams) {
  const { costTemplateSettings } = useCostTemplateSettings();
  const form = useForm<GreenBeanFormInput>({
    defaultValues: initialValues,
  });

  const { clearErrors, control, formState: { errors }, handleSubmit, reset, setError, setFocus, setValue, watch } = form;

  const currentRoastInputGrams = watch('defaultRoastInputGrams');
  const currentPurchasedTotalPrice = watch('purchasedTotalPrice');
  const currentPurchasedWeightGrams = watch('purchasedWeightGrams');
  const currentRemainingWeightGrams = watch('remainingWeightGrams');
  const currentDefaultSaleUnitPrice = watch('defaultSaleUnitPrice');
  const currentDefaultSaleUnitWeightGrams = watch('defaultSaleUnitWeightGrams');

  const {
    selectedTemplate,
    templatePreview,
    handleTemplateChange,
    resetTemplateSelection,
  } = useCostTemplateSync({
    enableCostTemplateSelection,
    autoApplyDefaultCostTemplate,
    initialTemplateId: initialValues.costTemplateId ?? null,
    setValue,
    currentPurchasedTotalPrice,
    currentPurchasedWeightGrams,
    currentRoastInputGrams,
  });

  const {
    handleWeightChange: handleSaleWeightChange,
    handlePriceChange: handleSalePriceChange,
    resetManualTracking: resetSaleDefaultsTracking,
  } = useSaleDefaultsAutoSync({
    autoApplyDefaultCostTemplate,
    enableCostTemplateSelection,
    selectedTemplate,
    templatePreview,
    currentDefaultSaleUnitPrice,
    currentDefaultSaleUnitWeightGrams: currentDefaultSaleUnitWeightGrams ?? null,
    setValue,
  });

  useRemainingWeightSync({
    currentPurchasedWeightGrams,
    currentRemainingWeightGrams,
    initialPurchasedWeight: initialValues.purchasedWeightGrams,
    setValue,
  });

  useFormFieldFocus(focusFieldPath, setFocus);

  useFormInitialization({
    initialValues,
    reset,
    onResetCallbacks: [resetTemplateSelection, resetSaleDefaultsTracking],
  });

  return {
    control,
    errors,
    handleSubmit,
    reset,
    clearErrors,
    setError,
    setFocus,
    costTemplateSettings,
    currentRoastInputGrams,
    selectedTemplate,
    templatePreview,
    handleTemplateChange,
    handleSaleWeightChange,
    handleSalePriceChange,
  };
}
