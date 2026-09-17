import { useEffect, useRef } from 'react';
import type { UseFormSetValue } from 'react-hook-form';

import type { CostTemplate } from '@/modules/settings/types';
import type { GreenBeanFormInput } from '../types/localGreenBean';

interface UseSaleDefaultsAutoSyncParams {
  autoApplyDefaultCostTemplate: boolean;
  enableCostTemplateSelection: boolean;
  selectedTemplate: CostTemplate | null;
  templatePreview: { errorMessage: string | null; values: { defaultSaleUnitPrice: number; defaultSaleUnitWeightGrams: number } | null };
  currentDefaultSaleUnitPrice: number;
  currentDefaultSaleUnitWeightGrams: number | null;
  setValue: UseFormSetValue<GreenBeanFormInput>;
}

interface UseSaleDefaultsAutoSyncReturn {
  handleWeightChange: (value: number | null) => void;
  handlePriceChange: (value: number) => void;
  resetManualTracking: () => void;
}

export function useSaleDefaultsAutoSync({
  autoApplyDefaultCostTemplate,
  enableCostTemplateSelection,
  selectedTemplate,
  templatePreview,
  currentDefaultSaleUnitPrice,
  currentDefaultSaleUnitWeightGrams,
  setValue,
}: UseSaleDefaultsAutoSyncParams): UseSaleDefaultsAutoSyncReturn {
  const lastAutoSaleDefaultsRef = useRef<{ price: number | null; weight: number | null }>({
    price: null,
    weight: null,
  });
  const manualSaleDefaultsRef = useRef({
    price: false,
    weight: false,
  });
  const templateSyncShouldDirtyRef = useRef(false);

  useEffect(() => {
    if (!autoApplyDefaultCostTemplate || !enableCostTemplateSelection || !selectedTemplate || !templatePreview.values) {
      return;
    }

    const shouldDirty = templateSyncShouldDirtyRef.current;
    const nextWeight = templatePreview.values.defaultSaleUnitWeightGrams;
    const nextPrice = templatePreview.values.defaultSaleUnitPrice;
    const lastAutoDefaults = lastAutoSaleDefaultsRef.current;

    if (
      !manualSaleDefaultsRef.current.weight ||
      currentDefaultSaleUnitWeightGrams == null ||
      currentDefaultSaleUnitWeightGrams === lastAutoDefaults.weight
    ) {
      setValue('defaultSaleUnitWeightGrams', nextWeight, { shouldDirty });
      lastAutoDefaults.weight = nextWeight;
    }

    if (
      !manualSaleDefaultsRef.current.price ||
      Math.abs(currentDefaultSaleUnitPrice - (lastAutoDefaults.price ?? Number.NaN)) < 0.005
    ) {
      setValue('defaultSaleUnitPrice', nextPrice, { shouldDirty });
      lastAutoDefaults.price = nextPrice;
    }

    templateSyncShouldDirtyRef.current = true;
  }, [
    autoApplyDefaultCostTemplate,
    currentDefaultSaleUnitPrice,
    currentDefaultSaleUnitWeightGrams,
    enableCostTemplateSelection,
    selectedTemplate,
    setValue,
    templatePreview,
  ]);

  const handleWeightChange = (value: number | null) => {
    manualSaleDefaultsRef.current.weight = true;
    setValue('defaultSaleUnitWeightGrams', value, { shouldDirty: true });
  };

  const handlePriceChange = (value: number) => {
    manualSaleDefaultsRef.current.price = true;
    setValue('defaultSaleUnitPrice', value, { shouldDirty: true });
  };

  const resetManualTracking = () => {
    lastAutoSaleDefaultsRef.current = {
      price: null,
      weight: null,
    };
    manualSaleDefaultsRef.current = {
      price: false,
      weight: false,
    };
    templateSyncShouldDirtyRef.current = false;
  };

  return {
    handleWeightChange,
    handlePriceChange,
    resetManualTracking,
  };
}
