import { useEffect, useMemo, useState } from 'react';
import type { UseFormSetValue } from 'react-hook-form';

import { useCostTemplateSettings } from '@/modules/settings/hooks';
import type { CostTemplate } from '@/modules/settings/types';
import { calculateTemplateDrivenSaleDefaults } from '../utils/beanForm.utils';
import type { GreenBeanFormInput } from '../types/localGreenBean';

interface UseCostTemplateSyncParams {
  enableCostTemplateSelection: boolean;
  autoApplyDefaultCostTemplate: boolean;
  initialTemplateId: string | null;
  setValue: UseFormSetValue<GreenBeanFormInput>;
  currentPurchasedTotalPrice: number;
  currentPurchasedWeightGrams: number;
  currentRoastInputGrams: number;
}

interface UseCostTemplateSyncReturn {
  selectedTemplateId: string | null;
  selectedTemplate: CostTemplate | null;
  templatePreview: { errorMessage: string | null; values: { defaultSaleUnitPrice: number; defaultSaleUnitWeightGrams: number } | null };
  handleTemplateChange: (templateId: string | null) => void;
  resetTemplateSelection: () => void;
}

export function useCostTemplateSync({
  enableCostTemplateSelection,
  autoApplyDefaultCostTemplate,
  initialTemplateId,
  setValue,
  currentPurchasedTotalPrice,
  currentPurchasedWeightGrams,
  currentRoastInputGrams,
}: UseCostTemplateSyncParams): UseCostTemplateSyncReturn {
  const { costTemplateSettings } = useCostTemplateSettings();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialTemplateId);
  const [shouldDirty, setShouldDirty] = useState(false);

  const selectedTemplate = useMemo(() => {
    if (!enableCostTemplateSelection) {
      return null;
    }

    return (
      costTemplateSettings.templates.find((template) => template.id === selectedTemplateId) ?? null
    );
  }, [costTemplateSettings.templates, enableCostTemplateSelection, selectedTemplateId]);

  const templatePreview = useMemo(() => {
    if (!selectedTemplate) {
      return { errorMessage: null, values: null };
    }

    try {
      return {
        errorMessage: null,
        values: calculateTemplateDrivenSaleDefaults(selectedTemplate, {
          defaultRoastInputGrams: currentRoastInputGrams > 0 ? currentRoastInputGrams : selectedTemplate.roastInputWeightGrams,
          purchasedTotalPrice: currentPurchasedTotalPrice,
          purchasedWeightGrams: currentPurchasedWeightGrams,
        }),
      };
    } catch (error) {
      return {
        errorMessage: error instanceof Error ? error.message : '无法生成模板建议售价，请调整模板参数。',
        values: null,
      };
    }
  }, [currentPurchasedTotalPrice, currentPurchasedWeightGrams, currentRoastInputGrams, selectedTemplate]);

  useEffect(() => {
    if (!enableCostTemplateSelection) {
      return;
    }

    if (
      selectedTemplateId == null &&
      !shouldDirty &&
      autoApplyDefaultCostTemplate &&
      costTemplateSettings.defaultTemplateId
    ) {
      setSelectedTemplateId(costTemplateSettings.defaultTemplateId);
      setValue('costTemplateId', costTemplateSettings.defaultTemplateId, { shouldDirty: false });
      return;
    }

    if (selectedTemplateId != null) {
      setValue('costTemplateId', selectedTemplateId, { shouldDirty: false });
    }
  }, [
    autoApplyDefaultCostTemplate,
    costTemplateSettings.defaultTemplateId,
    enableCostTemplateSelection,
    selectedTemplateId,
    setValue,
    shouldDirty,
  ]);

  useEffect(() => {
    if (!enableCostTemplateSelection || !selectedTemplate) {
      return;
    }

    setValue('costTemplateId', selectedTemplate.id, { shouldDirty });
    setValue('defaultRoastInputGrams', selectedTemplate.roastInputWeightGrams, { shouldDirty });
    setShouldDirty(true);
  }, [enableCostTemplateSelection, selectedTemplate, setValue, shouldDirty]);

  const handleTemplateChange = (templateId: string | null) => {
    setShouldDirty(true);
    setSelectedTemplateId(templateId);
  };

  const resetTemplateSelection = () => {
    setShouldDirty(false);
    setSelectedTemplateId(initialTemplateId);
  };

  return {
    selectedTemplateId,
    selectedTemplate,
    templatePreview,
    handleTemplateChange,
    resetTemplateSelection,
  };
}
