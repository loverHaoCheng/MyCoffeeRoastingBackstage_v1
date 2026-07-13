import { beanCacheService } from '@/modules/bean/services/beanCache.service';
import { localGreenBeanService } from '@/modules/bean/services/localGreenBean.service';
import type { ApiResponse } from '@/services/api.types';
import type { Bean } from '@/types/domain';
import { parseFlavorTags, serializeFlavorTags } from '@/modules/bean/utils/flavorTags';
import { normalizeAgingDays, normalizeTastingEndDays } from '@/modules/bean/utils/postProcessDays';

import type { GreenBeanCreateInput, GreenBeanEditableDetail, GreenBeanUpdateInput } from '../../types';
import type { LocalGreenBeanRecord } from '../../types/localGreenBean';
import type {
  BeanCostTemplateSettingValue,
  BeanGradeSettingValue,
  BeanSaleDefaultsSettingValue,
  GreenBeanTableUpdateInput,
  RemoteGreenBeanInventoryRecord,
  RemoteGreenBeanRecord,
  RemotePurchaseBatchRecord,
  RemoteSaleSpecRecord,
  RemoteBeanRecord,
} from './bean.service.types';

export const ok = <T,>(data: T): ApiResponse<T> => ({
  code: 0,
  data,
  message: 'ok',
});

export const normalizeText = (value: null | string | undefined): null | string => {
  const nextValue = value?.trim() ?? '';

  return nextValue.length > 0 ? nextValue : null;
};

const toNullablePositiveNumber = (value: null | number | undefined): null | number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

export const normalizeRemainingWeightGrams = (
  input: Pick<GreenBeanUpdateInput, 'purchasedWeightGrams' | 'remainingWeightGrams'>,
): number => {
  return Math.min(Math.max(input.remainingWeightGrams, 0), input.purchasedWeightGrams);
};

export const mapBeanFormInputToTableInput = (input: GreenBeanUpdateInput): GreenBeanTableUpdateInput => ({
  aging_days: Math.max(0, Math.round(input.agingDays)),
  altitude_meters_max: toNullablePositiveNumber(input.altitudeMetersMax),
  altitude_meters_min: toNullablePositiveNumber(input.altitudeMetersMin),
  code: input.code.trim(),
  default_roast_input_grams: input.defaultRoastInputGrams,
  density_g_per_l: toNullablePositiveNumber(input.densityGPerL),
  display_name: input.displayName.trim(),
  flavor_tags: serializeFlavorTags(input.flavorTags),
  grade: normalizeText(input.grade),
  harvest_season: normalizeText(input.harvestSeason),
  mill_name: normalizeText(input.millName),
  moisture_percent: toNullablePositiveNumber(input.moisturePercent),
  notes: normalizeText(input.notes),
  origin_area: normalizeText(input.originArea),
  origin_country: normalizeText(input.originCountry),
  origin_region: normalizeText(input.originRegion),
  process_method: input.processMethod.trim(),
  tasting_end_days: Math.max(1, Math.round(input.tastingEndDays)),
  variety: input.variety.trim(),
});

export const mergeBeans = (beans: Bean[]): Bean[] => {
  const mergedMap = new Map<string, Bean>();

  [...beans, ...localGreenBeanService.listBeans()].forEach((bean) => {
    const key = String(bean.id);
    const existing = mergedMap.get(key);
    if (!existing || (existing.id.toString().startsWith('local-') && !key.startsWith('local-'))) {
      mergedMap.set(key, bean);
    }
  });

  return Array.from(mergedMap.values()).sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
};

export const getBootstrappedBeans = (): Bean[] => {
  return mergeBeans(beanCacheService.getBeans() ?? []);
};

export const mapRemoteBeanRecordToBean = (record: RemoteBeanRecord): Bean => ({
  id: record.id,
  name: record.name,
  origin: record.origin,
  process: record.process,
  stockKg: record.stock_kg,
  costPerKg: record.cost_per_kg,
  supplierName: null,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
  purchasedWeightGrams: Math.round(record.stock_kg * 1000),
  remainingWeightGrams: Math.round(record.stock_kg * 1000),
  purchasedTotalPrice: Math.round(record.cost_per_kg * record.stock_kg),
  purchaseDate: record.created_at.slice(0, 10),
  grade: record.grade,
  variety: record.grade,
  flavorTags: parseFlavorTags(record.flavor_tags),
  agingDays: record.aging_days ?? 14,
  tastingEndDays: record.tasting_end_days ?? 40,
});

export const mapRemoteGreenBeanInventoryRecordToBean = (
  record: RemoteGreenBeanInventoryRecord,
): Bean => ({
  agingDays: record.aging_days ?? 14,
  altitudeMetersMax: toNullablePositiveNumber(record.altitude_meters_max),
  altitudeMetersMin: toNullablePositiveNumber(record.altitude_meters_min),
  code: record.code,
  costPerKg: Number(record.weighted_cost_per_kg.toFixed(2)),
  costTemplateId: record.cost_template_id ?? null,
  createdAt: record.created_at,
  defaultRoastInputGrams: record.default_roast_input_grams,
  defaultSaleUnitPrice: record.default_sale_unit_price ?? 0,
  defaultSaleUnitWeightGrams: record.default_sale_unit_weight_grams ?? null,
  densityGPerL: toNullablePositiveNumber(record.density_g_per_l),
  flavorTags: parseFlavorTags(record.flavor_tags),
  grade: normalizeText(record.grade) ?? '',
  harvestSeason: record.harvest_season,
  id: record.id,
  moisturePercent: toNullablePositiveNumber(record.moisture_percent),
  name: record.display_name,
  notes: normalizeText(record.notes),
  origin: [record.origin_country, record.origin_region, record.origin_area].filter(Boolean).join(' · '),
  originArea: record.origin_area ?? undefined,
  originCountry: record.origin_country,
  originRegion: record.origin_region,
  process: record.process_method,
  purchaseDate: record.latest_purchase_date ?? record.created_at.slice(0, 10),
  purchasedTotalPrice: Number(record.total_purchased_price.toFixed(2)),
  purchasedWeightGrams: Math.round(record.total_purchased_weight_grams),
  remainingWeightGrams: Math.round(record.total_remaining_weight_grams),
  stockKg: Number((record.total_remaining_weight_grams / 1000).toFixed(1)),
  supplierName: record.latest_supplier_name ?? null,
  tastingEndDays: record.tasting_end_days ?? 40,
  updatedAt: record.updated_at,
  variety: record.variety,
});

export const mapRemoteEditableBeanToFormInput = (
  bean: RemoteGreenBeanRecord,
  latestPurchaseBatch: null | RemotePurchaseBatchRecord,
  defaultSaleSpec: null | RemoteSaleSpecRecord,
  savedSaleDefaults: null | BeanSaleDefaultsSettingValue,
  savedCostTemplate: null | BeanCostTemplateSettingValue,
  savedGrade: null | BeanGradeSettingValue,
): GreenBeanEditableDetail => ({
  agingDays: bean.aging_days ?? 14,
  altitudeMetersMax: toNullablePositiveNumber(bean.altitude_meters_max),
  altitudeMetersMin: toNullablePositiveNumber(bean.altitude_meters_min),
  beanId: bean.id,
  code: bean.code,
  costTemplateId: savedCostTemplate?.costTemplateId ?? null,
  defaultRoastInputGrams: bean.default_roast_input_grams,
  defaultSaleUnitPrice: savedSaleDefaults?.defaultSaleUnitPrice ?? defaultSaleSpec?.unit_price ?? 0,
  defaultSaleUnitWeightGrams:
    savedSaleDefaults?.defaultSaleUnitWeightGrams ?? defaultSaleSpec?.unit_weight_grams ?? null,
  densityGPerL: toNullablePositiveNumber(bean.density_g_per_l),
  displayName: bean.display_name,
  flavorTags: parseFlavorTags(bean.flavor_tags),
  grade: savedGrade?.grade ?? normalizeText(bean.grade),
  harvestSeason: bean.harvest_season ?? '',
  millName: normalizeText(bean.mill_name),
  moisturePercent: toNullablePositiveNumber(bean.moisture_percent),
  notes: normalizeText(bean.notes),
  originArea: normalizeText(bean.origin_area),
  originCountry: bean.origin_country ?? '',
  originRegion: bean.origin_region ?? '',
  processMethod: bean.process_method,
  purchaseDate: latestPurchaseBatch?.received_at ?? bean.created_at.slice(0, 10),
  purchasedTotalPrice: latestPurchaseBatch?.purchased_total_price ?? 0,
  purchasedWeightGrams: latestPurchaseBatch?.purchased_weight_grams ?? 0,
  remainingWeightGrams: latestPurchaseBatch?.remaining_weight_grams ?? 0,
  supplierName: normalizeText(latestPurchaseBatch?.supplier_name),
  tastingEndDays: bean.tasting_end_days ?? 40,
  variety: bean.variety,
});

export const compareIsoDateDesc = (left?: null | string, right?: null | string): number => {
  return new Date(right ?? 0).getTime() - new Date(left ?? 0).getTime();
};

export const getLatestPurchaseBatchRecord = (
  purchaseBatches: RemotePurchaseBatchRecord[],
): null | RemotePurchaseBatchRecord => {
  return [...purchaseBatches].sort((left, right) => compareIsoDateDesc(left.received_at, right.received_at))[0] ?? null;
};

const getPurchaseBatchTotals = (purchaseBatches: RemotePurchaseBatchRecord[]) => {
  const totalPurchasedPrice = purchaseBatches.reduce((sum, batch) => sum + batch.purchased_total_price, 0);
  const totalPurchasedWeightGrams = purchaseBatches.reduce((sum, batch) => sum + batch.purchased_weight_grams, 0);
  const totalRemainingWeightGrams = purchaseBatches.reduce((sum, batch) => sum + batch.remaining_weight_grams, 0);

  return {
    totalPurchasedPrice,
    totalPurchasedWeightGrams,
    totalRemainingWeightGrams,
    weightedCostPerKg:
      totalPurchasedWeightGrams > 0
        ? Number(((totalPurchasedPrice / totalPurchasedWeightGrams) * 1000).toFixed(2))
        : 0,
  };
};

export const getDefaultSaleSpecRecord = (
  saleSpecs: RemoteSaleSpecRecord[],
): null | RemoteSaleSpecRecord => {
  return saleSpecs.find((record) => record.is_default) ?? saleSpecs[0] ?? null;
};

export const getBeanSaleDefaultsSettingKey = (beanId: string): string => {
  return `green_bean_sale_defaults:${beanId}`;
};

export const getBeanCostTemplateSettingKey = (beanId: string): string => {
  return `green_bean_cost_template:${beanId}`;
};

export const getBeanGradeSettingKey = (beanId: string): string => {
  return `green_bean_grade:${beanId}`;
};

export const parseBeanSaleDefaultsSettingValue = (value: unknown): null | BeanSaleDefaultsSettingValue => {
  if (typeof value !== 'object' || value == null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    defaultSaleUnitPrice:
      typeof record.defaultSaleUnitPrice === 'number' && Number.isFinite(record.defaultSaleUnitPrice)
        ? record.defaultSaleUnitPrice
        : 0,
    defaultSaleUnitWeightGrams:
      typeof record.defaultSaleUnitWeightGrams === 'number' &&
      Number.isFinite(record.defaultSaleUnitWeightGrams) &&
      record.defaultSaleUnitWeightGrams > 0
        ? record.defaultSaleUnitWeightGrams
        : null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
};

export const parseBeanCostTemplateSettingValue = (value: unknown): null | BeanCostTemplateSettingValue => {
  if (typeof value !== 'object' || value == null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    costTemplateId: typeof record.costTemplateId === 'string' ? record.costTemplateId : null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
};

export const parseBeanGradeSettingValue = (value: unknown): null | BeanGradeSettingValue => {
  if (typeof value !== 'object' || value == null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    grade: normalizeText(record.grade as null | string | undefined),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
};

export const buildInventoryOverviewRecordFromTables = (
  bean: RemoteGreenBeanRecord,
  purchaseBatches: RemotePurchaseBatchRecord[],
  saleSpecs: RemoteSaleSpecRecord[],
  roastBatchCount: number,
  savedSaleDefaults: null | BeanSaleDefaultsSettingValue,
  savedCostTemplate: null | BeanCostTemplateSettingValue,
  savedGrade: null | BeanGradeSettingValue,
): RemoteGreenBeanInventoryRecord => {
  const latestPurchaseBatch = getLatestPurchaseBatchRecord(purchaseBatches);
  const defaultSaleSpec = getDefaultSaleSpecRecord(saleSpecs);
  const purchaseBatchTotals = getPurchaseBatchTotals(purchaseBatches);

  return {
    aging_days: bean.aging_days ?? 14,
    id: bean.id,
    altitude_meters_max: bean.altitude_meters_max,
    altitude_meters_min: bean.altitude_meters_min,
    code: bean.code,
    created_at: bean.created_at,
    cost_template_id: savedCostTemplate?.costTemplateId ?? null,
    default_roast_input_grams: bean.default_roast_input_grams,
    density_g_per_l: bean.density_g_per_l,
    default_sale_unit_price: savedSaleDefaults?.defaultSaleUnitPrice ?? defaultSaleSpec?.unit_price ?? null,
    default_sale_unit_weight_grams:
      savedSaleDefaults?.defaultSaleUnitWeightGrams ?? defaultSaleSpec?.unit_weight_grams ?? null,
    display_name: bean.display_name,
    flavor_tags: bean.flavor_tags ?? null,
    grade: savedGrade?.grade ?? bean.grade,
    harvest_season: bean.harvest_season ?? '',
    latest_purchase_date: latestPurchaseBatch?.received_at ?? null,
    latest_supplier_name: latestPurchaseBatch?.supplier_name ?? null,
    origin_area: bean.origin_area,
    origin_country: bean.origin_country ?? '',
    origin_region: bean.origin_region ?? '',
    process_method: bean.process_method,
    roast_record_count: roastBatchCount,
    tasting_end_days: bean.tasting_end_days ?? 40,
    mill_name: bean.mill_name,
    moisture_percent: bean.moisture_percent,
    notes: bean.notes,
    total_purchased_price: purchaseBatchTotals.totalPurchasedPrice,
    total_purchased_weight_grams: purchaseBatchTotals.totalPurchasedWeightGrams,
    total_remaining_weight_grams: purchaseBatchTotals.totalRemainingWeightGrams,
    updated_at:
      [bean.updated_at, latestPurchaseBatch?.updated_at, defaultSaleSpec?.updated_at]
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => compareIsoDateDesc(left, right))[0] ?? bean.updated_at,
    variety: bean.variety,
    weighted_cost_per_kg: purchaseBatchTotals.weightedCostPerKg,
  };
};

export const toLocalEditableBeanDetail = (localRecord: LocalGreenBeanRecord): GreenBeanEditableDetail => ({
  beanId: localRecord.id,
  agingDays: normalizeAgingDays(localRecord.agingDays),
  code: localRecord.code,
  defaultRoastInputGrams: localRecord.defaultRoastInputGrams,
  defaultSaleUnitPrice: localRecord.defaultSaleUnitPrice,
  defaultSaleUnitWeightGrams: localRecord.defaultSaleUnitWeightGrams ?? null,
  displayName: localRecord.displayName,
  flavorTags: localRecord.flavorTags,
  grade: localRecord.grade ?? null,
  harvestSeason: localRecord.harvestSeason ?? '',
  millName: localRecord.millName ?? null,
  notes: localRecord.notes ?? null,
  originArea: localRecord.originArea ?? null,
  originCountry: localRecord.originCountry ?? '',
  originRegion: localRecord.originRegion ?? '',
  processMethod: localRecord.processMethod,
  purchaseDate: localRecord.purchaseDate,
  purchasedTotalPrice: localRecord.purchasedTotalPrice,
  purchasedWeightGrams: localRecord.purchasedWeightGrams,
  remainingWeightGrams: localRecord.remainingWeightGrams,
  supplierName: localRecord.supplierName ?? null,
  tastingEndDays: normalizeTastingEndDays(localRecord.tastingEndDays, localRecord.agingDays),
  variety: localRecord.variety,
  altitudeMetersMax: localRecord.altitudeMetersMax ?? null,
  altitudeMetersMin: localRecord.altitudeMetersMin ?? null,
  densityGPerL: localRecord.densityGPerL ?? null,
  moisturePercent: localRecord.moisturePercent ?? null,
});

export const createMockBean = (input: GreenBeanCreateInput): Bean => {
  const now = new Date().toISOString();

  return {
    agingDays: input.agingDays,
    id: `mock-bean-${String(Date.now())}`,
    name: input.displayName.trim(),
    origin: [input.originCountry, input.originRegion, input.originArea].filter(Boolean).join(' · '),
    process: input.processMethod.trim(),
    purchaseDate: input.purchaseDate,
    purchasedTotalPrice: input.purchasedTotalPrice,
    purchasedWeightGrams: input.purchasedWeightGrams,
    remainingWeightGrams: input.remainingWeightGrams,
    grade: normalizeText(input.grade) ?? '',
    stockKg: Number((input.remainingWeightGrams / 1000).toFixed(1)),
    costPerKg:
      input.purchasedWeightGrams > 0
        ? Number(((input.purchasedTotalPrice / input.purchasedWeightGrams) * 1000).toFixed(2))
        : 0,
    supplierName: input.supplierName ?? null,
    tastingEndDays: input.tastingEndDays,
    createdAt: now,
    flavorTags: input.flavorTags,
    updatedAt: now,
    variety: input.variety.trim(),
    harvestSeason: normalizeText(input.harvestSeason) ?? undefined,
    code: input.code.trim(),
    costTemplateId: input.costTemplateId ?? null,
    defaultRoastInputGrams: input.defaultRoastInputGrams,
    defaultSaleUnitPrice: input.defaultSaleUnitPrice,
    defaultSaleUnitWeightGrams: input.defaultSaleUnitWeightGrams ?? null,
  };
};
