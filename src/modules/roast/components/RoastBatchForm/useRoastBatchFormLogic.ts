import { useMemo, useRef } from 'react';

import type { Bean, RoastPlan } from '@/types/domain';
import type { RoastBatchFormState } from './types';
import {
  resolveBeanCostTemplate,
  calculateRoastSaleCapacity,
} from '@/modules/finance/services/financeProfitCalculation.service';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import {
  calculateDehydrationRate,
  normalizeRoastLevel,
  resolveRoastLevelFromAgtron,
  resolveRoastLevelFromDehydrationRate,
} from '@/modules/roast/constants/roastLevel';
import { getSelectableRoastPlans } from '@/modules/roast/utils/roastPlanSelection';

interface UseRoastBatchFormLogicParams {
  beans: Bean[];
  plans: RoastPlan[];
  value: RoastBatchFormState;
}

export function useRoastBatchFormLogic({ beans, plans, value }: UseRoastBatchFormLogicParams) {
  const { costTemplateSettings } = useCostTemplateSettings();
  const roastLevelManualOverrideRef = useRef(false);

  const availablePlans = useMemo(
    () => getSelectableRoastPlans(plans, value.greenBeanId),
    [value.greenBeanId, plans],
  );

  const selectedBean = useMemo(
    () => beans.find((bean) => String(bean.id) === value.greenBeanId) ?? null,
    [beans, value.greenBeanId],
  );

  const selectedCostTemplate = useMemo(() => {
    if (!selectedBean) {
      return null;
    }

    return resolveBeanCostTemplate(
      selectedBean,
      new Map(costTemplateSettings.templates.map((item) => [item.id, item])),
    );
  }, [costTemplateSettings.templates, selectedBean]);

  const maximumSoldUnitCount = useMemo(() => {
    return selectedCostTemplate
      ? calculateRoastSaleCapacity(value.inputWeightGrams, selectedCostTemplate).maximumSoldUnitCount
      : null;
  }, [selectedCostTemplate, value.inputWeightGrams]);

  const dehydrationRate = useMemo(
    () => calculateDehydrationRate(value.inputWeightGrams, value.outputWeightGrams),
    [value.inputWeightGrams, value.outputWeightGrams],
  );

  const suggestedRoastLevel = useMemo(() => {
    if (value.roastLevelSource === 'beanAgtron') {
      return resolveRoastLevelFromAgtron(value.beanAgtronColor ?? Number.NaN)
        ?? normalizeRoastLevel(value.roastLevel);
    }

    if (value.roastLevelSource === 'groundAgtron') {
      return resolveRoastLevelFromAgtron(value.groundAgtronColor ?? Number.NaN)
        ?? normalizeRoastLevel(value.roastLevel);
    }

    return resolveRoastLevelFromDehydrationRate(dehydrationRate);
  }, [dehydrationRate, value.beanAgtronColor, value.groundAgtronColor, value.roastLevel, value.roastLevelSource]);

  const normalizedRoastLevel = normalizeRoastLevel(value.roastLevel);

  const lossRate = value.inputWeightGrams > 0
    ? (((value.inputWeightGrams - value.outputWeightGrams) / value.inputWeightGrams) * 100).toFixed(1)
    : '-';

  return {
    availablePlans,
    selectedBean,
    selectedCostTemplate,
    maximumSoldUnitCount,
    dehydrationRate,
    suggestedRoastLevel,
    normalizedRoastLevel,
    lossRate,
    roastLevelManualOverrideRef,
  };
}
