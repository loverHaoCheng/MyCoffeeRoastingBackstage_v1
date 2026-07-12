import type { FieldPath } from 'react-hook-form';

import { calculateCostMetrics } from '@/modules/finance/services';
import type { CostTemplate } from '@/modules/settings/types';
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';

export const beanFormFieldPathMap: Record<string, FieldPath<GreenBeanFormInput>> = {
  altitudeMetersMax: 'altitudeMetersMax',
  altitudeMetersMin: 'altitudeMetersMin',
  agingDays: 'agingDays',
  code: 'code',
  costTemplateId: 'costTemplateId',
  defaultRoastInputGrams: 'defaultRoastInputGrams',
  defaultSaleUnitPrice: 'defaultSaleUnitPrice',
  defaultSaleUnitWeightGrams: 'defaultSaleUnitWeightGrams',
  densityGPerL: 'densityGPerL',
  displayName: 'displayName',
  flavorTags: 'flavorTags',
  grade: 'grade',
  harvestSeason: 'harvestSeason',
  millName: 'millName',
  moisturePercent: 'moisturePercent',
  notes: 'notes',
  originArea: 'originArea',
  originCountry: 'originCountry',
  originRegion: 'originRegion',
  processMethod: 'processMethod',
  purchaseDate: 'purchaseDate',
  purchasedTotalPrice: 'purchasedTotalPrice',
  purchasedWeightGrams: 'purchasedWeightGrams',
  remainingWeightGrams: 'remainingWeightGrams',
  supplierName: 'supplierName',
  tastingEndDays: 'tastingEndDays',
  variety: 'variety',
};

export const calculateTemplateDrivenSaleDefaults = (
  template: CostTemplate,
  values: Pick<GreenBeanFormInput, 'defaultRoastInputGrams' | 'purchasedTotalPrice' | 'purchasedWeightGrams'>,
) => {
  const purchaseCostPerKg = values.purchasedWeightGrams > 0
    ? Number(((values.purchasedTotalPrice / values.purchasedWeightGrams) * 1000).toFixed(2))
    : 0;
  const metrics = calculateCostMetrics({
    beanId: '', beanName: '', calculationName: '', dehydrationRate: template.dehydrationRate,
    energyCost: template.energyCost, laborCost: template.laborCost, notes: '', otherCost: template.otherCost,
    packagingCost: template.packagingCost, purchaseCostPerKg, roastInputWeightGrams: values.defaultRoastInputGrams,
    saleUnitPrice: 0, saleUnitWeightGrams: template.saleUnitWeightGrams, targetProfitRate: template.targetProfitRate,
  });

  return { defaultSaleUnitPrice: metrics.suggestedSalePrice, defaultSaleUnitWeightGrams: template.saleUnitWeightGrams };
};
