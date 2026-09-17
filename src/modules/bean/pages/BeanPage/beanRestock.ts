import { createDefaultBeanFormValues } from '@/modules/bean/constants';
import type { Bean } from '@/types/domain';
import type { GreenBeanCreateInput } from '@/modules/bean/types';

export const mapBeanToRestockInitialValues = (bean: Bean): GreenBeanCreateInput => {
  const defaultValues = createDefaultBeanFormValues();
  const totalPurchasedWeightGrams = Math.max(
    0,
    Math.round(bean.purchasedWeightGrams ?? bean.remainingWeightGrams ?? bean.stockKg * 1000),
  );
  const nextPurchasedWeightGrams = totalPurchasedWeightGrams > 0 ? totalPurchasedWeightGrams : 1000;

  return {
    ...defaultValues,
    agingDays: bean.agingDays ?? defaultValues.agingDays,
    altitudeMetersMax: bean.altitudeMetersMax ?? null,
    altitudeMetersMin: bean.altitudeMetersMin ?? null,
    costTemplateId: bean.costTemplateId ?? null,
    defaultRoastInputGrams: bean.defaultRoastInputGrams ?? defaultValues.defaultRoastInputGrams,
    defaultSaleUnitPrice: bean.defaultSaleUnitPrice ?? 0,
    defaultSaleUnitWeightGrams: bean.defaultSaleUnitWeightGrams ?? null,
    densityGPerL: bean.densityGPerL ?? null,
    displayName: bean.name,
    flavorTags: [...(bean.flavorTags ?? [])],
    grade: bean.grade,
    harvestSeason: bean.harvestSeason ?? '',
    millName: bean.millName ?? '',
    moisturePercent: bean.moisturePercent ?? null,
    notes: bean.notes ?? '',
    originArea: bean.originArea ?? '',
    originCountry: bean.originCountry ?? '',
    originRegion: bean.originRegion ?? '',
    processMethod: bean.process,
    purchasedTotalPrice: bean.purchasedTotalPrice ?? 0,
    purchasedWeightGrams: nextPurchasedWeightGrams,
    remainingWeightGrams: nextPurchasedWeightGrams,
    supplierName: bean.supplierName ?? '',
    tastingEndDays: bean.tastingEndDays ?? defaultValues.tastingEndDays,
    variety: bean.variety ?? '',
  };
};
