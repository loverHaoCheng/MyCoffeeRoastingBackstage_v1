import { normalizeAgingDays, normalizeTastingEndDays } from '@/modules/bean/utils/postProcessDays';
import { normalizeFlavorTags } from '@/modules/bean/utils/flavorTags';
import type { Bean } from '@/types/domain';
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';
import { parseOriginCountry } from './originUtils';

export const createFallbackEditableDetail = (bean: Bean): GreenBeanFormInput => {
  const purchasedWeightGrams = Math.max(0, Math.round(bean.purchasedWeightGrams ?? bean.stockKg * 1000));
  const remainingWeightGrams = Math.max(0, Math.round(bean.remainingWeightGrams ?? bean.stockKg * 1000));
  const totalPurchasedPrice = Math.max(
    0,
    Number((bean.purchasedTotalPrice ?? bean.costPerKg * (purchasedWeightGrams / 1000)).toFixed(2)),
  );

  return {
    altitudeMetersMax: bean.altitudeMetersMax ?? null,
    altitudeMetersMin: bean.altitudeMetersMin ?? null,
    agingDays: normalizeAgingDays(bean.agingDays),
    code: bean.code ?? '',
    costTemplateId: bean.costTemplateId ?? null,
    defaultRoastInputGrams: bean.defaultRoastInputGrams ?? 0,
    defaultSaleUnitPrice: bean.defaultSaleUnitPrice ?? 0,
    defaultSaleUnitWeightGrams: bean.defaultSaleUnitWeightGrams ?? null,
    densityGPerL: bean.densityGPerL ?? null,
    displayName: bean.name,
    flavorTags: normalizeFlavorTags(bean.flavorTags),
    grade: bean.grade,
    harvestSeason: bean.harvestSeason ?? '',
    millName: bean.millName ?? '',
    moisturePercent: bean.moisturePercent ?? null,
    notes: bean.notes ?? '',
    originArea: bean.originArea ?? '',
    originCountry: bean.originCountry?.trim() ? bean.originCountry : parseOriginCountry(bean.origin),
    originRegion: bean.originRegion ?? '',
    processMethod: bean.process,
    purchaseDate: bean.purchaseDate ?? bean.createdAt.slice(0, 10),
    purchasedTotalPrice: totalPurchasedPrice,
    purchasedWeightGrams,
    remainingWeightGrams,
    supplierName: bean.supplierName ?? '',
    tastingEndDays: normalizeTastingEndDays(bean.tastingEndDays, bean.agingDays),
    variety: bean.variety ?? '',
  };
};
