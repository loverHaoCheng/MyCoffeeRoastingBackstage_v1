import { beanCacheService } from '@/modules/bean/services/beanCache.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import {
  localGreenBeanService,
  mapLocalGreenBeanRecordToBean,
} from '@/modules/bean/services/localGreenBean.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { isPocketBaseProjectConnectionConfigured } from '@/modules/settings/types';
import { logger } from '@/shared/logger/logger';
import { AppError } from '@/shared/errors/AppError';
import type { ApiResponse } from '@/services/api.types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';
import type { Bean } from '@/types/domain';
import { parseFlavorTags, serializeFlavorTags } from '@/modules/bean/utils/flavorTags';
import { normalizeAgingDays, normalizeTastingEndDays } from '@/modules/bean/utils/postProcessDays';

import type { GreenBeanCreateInput, GreenBeanEditableDetail, GreenBeanUpdateInput } from '../types';
import type { LocalGreenBeanRecord } from '../types/localGreenBean';

interface GreenBeanTableUpdateInput {
  aging_days?: number;
  altitude_meters_max?: null | number;
  altitude_meters_min?: null | number;
  code?: string;
  default_roast_input_grams?: number;
  density_g_per_l?: null | number;
  display_name?: string;
  flavor_tags?: null | string;
  grade?: null | string;
  harvest_season?: null | string;
  mill_name?: null | string;
  moisture_percent?: null | number;
  notes?: null | string;
  origin_area?: null | string;
  origin_country?: null | string;
  origin_region?: null | string;
  process_method?: string;
  tasting_end_days?: number;
  variety?: string;
}

interface EditablePurchaseBatchInput {
  purchased_total_price: number;
  purchased_weight_grams: number;
  remaining_weight_grams: number;
  supplier_name?: null | string;
}

export interface BeanRepository {
  adjustRemainingWeight(beanId: string | number, deltaGrams: number): Promise<ApiResponse<Bean>>;
  createBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>>;
  getEditableBean(beanId: string | number): Promise<ApiResponse<GreenBeanEditableDetail>>;
  getBeanById(beanId: string | number): Promise<ApiResponse<Bean | null>>;
  listBeans(): Promise<ApiResponse<Bean[]>>;
  syncBeans(): Promise<ApiResponse<Bean[]>>;
  updateBean(beanId: string | number, input: GreenBeanUpdateInput): Promise<ApiResponse<Bean>>;
  deleteBean(beanId: string | number): Promise<void>;
}

export interface RemoteBeanRecord {
  aging_days?: number;
  id: number;
  name: string;
  flavor_tags?: null | string;
  origin: string;
  process: string;
  grade: string;
  stock_kg: number;
  cost_per_kg: number;
  supplier_id: number;
  tasting_end_days?: number;
  created_at: string;
  updated_at: string;
}

interface RemoteGreenBeanInventoryRecord {
  aging_days?: number;
  id: string;
  altitude_meters_max: null | number;
  altitude_meters_min: null | number;
  code: string;
  created_at: string;
  cost_template_id: null | string;
  default_roast_input_grams: number;
  default_sale_unit_price: null | number;
  default_sale_unit_weight_grams: null | number;
  display_name: string;
  flavor_tags?: null | string;
  grade: null | string;
  harvest_season: string;
  density_g_per_l: null | number;
  mill_name: null | string;
  moisture_percent: null | number;
  notes: null | string;
  latest_supplier_name?: null | string;
  origin_area: null | string;
  origin_country: string;
  origin_region: string;
  process_method: string;
  roast_record_count: number;
  tasting_end_days?: number;
  total_purchased_price: number;
  total_purchased_weight_grams: number;
  total_remaining_weight_grams: number;
  updated_at: string;
  variety: string;
  weighted_cost_per_kg: number;
}

interface RemoteGreenBeanRecord {
  aging_days?: number;
  altitude_meters_max: null | number;
  altitude_meters_min: null | number;
  code: string;
  created_at: string;
  default_roast_input_grams: number;
  density_g_per_l: null | number;
  display_name: string;
  flavor_tags?: null | string;
  grade: null | string;
  harvest_season: null | string;
  id: string;
  mill_name: null | string;
  moisture_percent: null | number;
  notes: null | string;
  origin_area: null | string;
  origin_country: null | string;
  origin_region: null | string;
  process_method: string;
  tasting_end_days?: number;
  updated_at: string;
  variety: string;
}

interface RemotePurchaseBatchRecord {
  created_at?: string;
  green_bean_id?: string;
  id: string;
  purchased_total_price: number;
  purchased_weight_grams: number;
  received_at?: string;
  remaining_weight_grams: number;
  supplier_name: null | string;
  updated_at?: string;
}

interface RemoteSaleSpecRecord {
  created_at?: string;
  green_bean_id?: string;
  id: string;
  is_default?: boolean;
  unit_price: number;
  unit_weight_grams: number;
  updated_at?: string;
}

interface RemoteRoastBatchOverviewRecord {
  green_bean_id: string;
  id: string;
  updated_at?: string;
}

interface RemoteAppSettingRecord {
  id: string;
  key: string;
  updated_at?: null | string;
  value: unknown;
}

interface BeanSaleDefaultsSettingValue {
  defaultSaleUnitPrice: number;
  defaultSaleUnitWeightGrams: null | number;
  updatedAt?: null | string;
}

interface BeanCostTemplateSettingValue {
  costTemplateId: null | string;
  updatedAt?: null | string;
}

interface BeanGradeSettingValue {
  grade: null | string;
  updatedAt?: null | string;
}

interface RemoteErrorLike {
  message: string;
}

interface RemoteQueryResult<T> {
  data: T[] | null;
  error: RemoteErrorLike | null;
}

interface RemoteBeanSelectBuilder {
  order(column: string, options?: { ascending?: boolean }): Promise<RemoteQueryResult<RemoteBeanRecord>>;
}

interface RemoteBeanTable {
  select(columns: string): RemoteBeanSelectBuilder;
}

export interface RemoteBeanClient {
  from(tableName: string): RemoteBeanTable;
}

const ok = <T,>(data: T): ApiResponse<T> => ({
  code: 0,
  data,
  message: 'ok',
});

const normalizeText = (value: null | string | undefined): null | string => {
  const nextValue = value?.trim() ?? '';

  return nextValue.length > 0 ? nextValue : null;
};

const toNullableNumber = (value: null | number | undefined): null | number => {
  return value ?? null;
};

const normalizeRemainingWeightGrams = (input: Pick<GreenBeanUpdateInput, 'purchasedWeightGrams' | 'remainingWeightGrams'>): number => {
  return Math.min(Math.max(input.remainingWeightGrams, 0), input.purchasedWeightGrams);
};

const mapBeanFormInputToTableInput = (input: GreenBeanUpdateInput): GreenBeanTableUpdateInput => ({
  aging_days: Math.max(0, Math.round(input.agingDays)),
  altitude_meters_max: toNullableNumber(input.altitudeMetersMax),
  altitude_meters_min: toNullableNumber(input.altitudeMetersMin),
  code: input.code.trim(),
  default_roast_input_grams: input.defaultRoastInputGrams,
  density_g_per_l: toNullableNumber(input.densityGPerL),
  display_name: input.displayName.trim(),
  flavor_tags: serializeFlavorTags(input.flavorTags),
  grade: normalizeText(input.grade),
  harvest_season: normalizeText(input.harvestSeason),
  mill_name: normalizeText(input.millName),
  moisture_percent: toNullableNumber(input.moisturePercent),
  notes: normalizeText(input.notes),
  origin_area: normalizeText(input.originArea),
  origin_country: normalizeText(input.originCountry),
  origin_region: normalizeText(input.originRegion),
  process_method: input.processMethod.trim(),
  tasting_end_days: Math.max(1, Math.round(input.tastingEndDays)),
  variety: input.variety.trim(),
});

const mergeBeans = (beans: Bean[]): Bean[] => {
  const mergedMap = new Map<string, Bean>();

  // 第一遍：按 ID 合并（远端记录优先）
  [...beans, ...localGreenBeanService.listBeans()].forEach((bean) => {
    const key = String(bean.id);
    const existing = mergedMap.get(key);
    // 非本地记录（来自远端主库）优先于本地记录
    if (!existing || (existing.id.toString().startsWith('local-') && !key.startsWith('local-'))) {
      mergedMap.set(key, bean);
    }
  });

  // 第二遍：按名称去重本地残留（远端已有的生豆，本地同名的不应再显示）
  const remoteNames = new Set<string>();
  mergedMap.forEach((bean) => {
    if (!String(bean.id).startsWith('local-')) {
      remoteNames.add(bean.name.trim());
    }
  });
  if (remoteNames.size > 0) {
    for (const [key, bean] of mergedMap.entries()) {
      if (
        String(bean.id).startsWith('local-') &&
        remoteNames.has(bean.name.trim())
      ) {
        // 本地记录与远程同名，自动清理
        mergedMap.delete(key);
        localGreenBeanService.removeByCode(
          localGreenBeanService.listRecords().find((r) => r.id === bean.id)?.code ?? '',
        );
      }
    }
  }

  return [...mergedMap.values()].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
};

const getBootstrappedBeans = (): Bean[] => {
  return mergeBeans(beanCacheService.getBeans() ?? []);
};

export const mapRemoteBeanRecordToBean = (record: RemoteBeanRecord): Bean => ({
  agingDays: normalizeAgingDays(record.aging_days),
  id: record.id,
  flavorTags: parseFlavorTags(record.flavor_tags),
  name: record.name,
  origin: record.origin,
  process: record.process,
  grade: record.grade,
  stockKg: record.stock_kg,
  costPerKg: record.cost_per_kg,
  supplierId: record.supplier_id,
  tastingEndDays: normalizeTastingEndDays(record.tasting_end_days, record.aging_days),
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

export const mapRemoteGreenBeanInventoryRecordToBean = (
  record: RemoteGreenBeanInventoryRecord,
): Bean => ({
  agingDays: normalizeAgingDays(record.aging_days),
  id: record.id,
  altitudeMetersMax: record.altitude_meters_max,
  altitudeMetersMin: record.altitude_meters_min,
  name: record.display_name,
  code: record.code,
  costTemplateId: record.cost_template_id,
  defaultRoastInputGrams: record.default_roast_input_grams,
  defaultSaleUnitPrice: record.default_sale_unit_price,
  defaultSaleUnitWeightGrams: record.default_sale_unit_weight_grams,
  densityGPerL: record.density_g_per_l,
  flavorTags: parseFlavorTags(record.flavor_tags),
  harvestSeason: record.harvest_season,
  millName: record.mill_name,
  moisturePercent: record.moisture_percent,
  notes: record.notes,
  origin: [record.origin_country, record.origin_region, record.origin_area].filter(Boolean).join(' · '),
  originArea: record.origin_area,
  originCountry: record.origin_country,
  originRegion: record.origin_region,
  process: record.process_method,
  grade: normalizeText(record.grade) ?? '',
  purchasedTotalPrice: record.total_purchased_price,
  purchasedWeightGrams: record.total_purchased_weight_grams,
  remainingWeightGrams: record.total_remaining_weight_grams,
  stockKg: Number((record.total_remaining_weight_grams / 1000).toFixed(1)),
  costPerKg: record.weighted_cost_per_kg,
  supplierName: record.latest_supplier_name ?? null,
  tastingEndDays: normalizeTastingEndDays(record.tasting_end_days, record.aging_days),
  createdAt: record.created_at,
  updatedAt: record.updated_at,
  variety: record.variety,
});

const mapRemoteEditableBeanToFormInput = (
  bean: RemoteGreenBeanRecord,
  latestPurchaseBatch: null | RemotePurchaseBatchRecord,
  defaultSaleSpec: null | RemoteSaleSpecRecord,
  savedSaleDefaults: null | BeanSaleDefaultsSettingValue,
  savedCostTemplate: null | BeanCostTemplateSettingValue,
  savedGrade: null | BeanGradeSettingValue,
): GreenBeanEditableDetail => ({
  beanId: bean.id,
  agingDays: normalizeAgingDays(bean.aging_days),
  costTemplateId: savedCostTemplate?.costTemplateId ?? null,
  code: bean.code,
  defaultRoastInputGrams: bean.default_roast_input_grams,
  defaultSaleSpecId: defaultSaleSpec?.id ?? null,
  defaultSaleUnitPrice: savedSaleDefaults?.defaultSaleUnitPrice ?? defaultSaleSpec?.unit_price ?? 0,
  defaultSaleUnitWeightGrams:
    savedSaleDefaults?.defaultSaleUnitWeightGrams ?? defaultSaleSpec?.unit_weight_grams ?? null,
  displayName: bean.display_name,
  flavorTags: parseFlavorTags(bean.flavor_tags),
  grade: savedGrade?.grade ?? bean.grade,
  harvestSeason: bean.harvest_season,
  millName: bean.mill_name,
  notes: bean.notes,
  originArea: bean.origin_area,
  originCountry: bean.origin_country,
  originRegion: bean.origin_region,
  processMethod: bean.process_method,
  purchaseBatchId: latestPurchaseBatch?.id ?? null,
  purchasedTotalPrice: latestPurchaseBatch?.purchased_total_price ?? 0,
  purchasedWeightGrams: latestPurchaseBatch?.purchased_weight_grams ?? 0,
  remainingWeightGrams:
    latestPurchaseBatch?.remaining_weight_grams ?? latestPurchaseBatch?.purchased_weight_grams ?? 0,
  supplierName: latestPurchaseBatch?.supplier_name ?? null,
  tastingEndDays: normalizeTastingEndDays(bean.tasting_end_days, bean.aging_days),
  variety: bean.variety,
  altitudeMetersMax: bean.altitude_meters_max,
  altitudeMetersMin: bean.altitude_meters_min,
  densityGPerL: bean.density_g_per_l,
  moisturePercent: bean.moisture_percent,
});

const compareIsoDateDesc = (left?: null | string, right?: null | string): number => {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;

  return rightTime - leftTime;
};

const getLatestPurchaseBatchRecord = (
  purchaseBatches: RemotePurchaseBatchRecord[],
): null | RemotePurchaseBatchRecord => {
  return [...purchaseBatches].sort((left, right) => {
    const receivedAtComparison = compareIsoDateDesc(left.received_at, right.received_at);

    if (receivedAtComparison !== 0) {
      return receivedAtComparison;
    }

    return compareIsoDateDesc(left.created_at, right.created_at);
  })[0] ?? null;
};

const getPurchaseBatchTotals = (
  purchaseBatches: RemotePurchaseBatchRecord[],
): {
  totalPurchasedPrice: number;
  totalPurchasedWeightGrams: number;
  totalRemainingWeightGrams: number;
  weightedCostPerKg: number;
} => {
  const totalPurchasedPrice = purchaseBatches.reduce((total, batch) => total + batch.purchased_total_price, 0);
  const totalPurchasedWeightGrams = purchaseBatches.reduce((total, batch) => total + batch.purchased_weight_grams, 0);
  const totalRemainingWeightGrams = purchaseBatches.reduce((total, batch) => total + batch.remaining_weight_grams, 0);

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

const getDefaultSaleSpecRecord = (
  saleSpecs: RemoteSaleSpecRecord[],
): null | RemoteSaleSpecRecord => {
  return (
    [...saleSpecs]
      .filter((saleSpec) => saleSpec.is_default !== false)
      .sort((left, right) => {
        const updatedAtComparison = compareIsoDateDesc(left.updated_at, right.updated_at);

        if (updatedAtComparison !== 0) {
          return updatedAtComparison;
        }

        return compareIsoDateDesc(left.created_at, right.created_at);
      })[0] ?? null
  );
};

const getBeanSaleDefaultsSettingKey = (beanId: string): string => {
  return `green_bean_sale_defaults:${beanId}`;
};

const getBeanCostTemplateSettingKey = (beanId: string): string => {
  return `green_bean_cost_template:${beanId}`;
};

const getBeanGradeSettingKey = (beanId: string): string => {
  return `green_bean_grade:${beanId}`;
};

const parseBeanSaleDefaultsSettingValue = (value: unknown): null | BeanSaleDefaultsSettingValue => {
  if (typeof value !== 'object' || value == null) {
    return null;
  }

  const record = value as Partial<BeanSaleDefaultsSettingValue>;

  if (typeof record.defaultSaleUnitPrice !== 'number' || !Number.isFinite(record.defaultSaleUnitPrice)) {
    return null;
  }

  if (
    record.defaultSaleUnitWeightGrams != null &&
    (typeof record.defaultSaleUnitWeightGrams !== 'number' || !Number.isFinite(record.defaultSaleUnitWeightGrams))
  ) {
    return null;
  }

  return {
    defaultSaleUnitPrice: record.defaultSaleUnitPrice,
    defaultSaleUnitWeightGrams: record.defaultSaleUnitWeightGrams ?? null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
};

const parseBeanCostTemplateSettingValue = (value: unknown): null | BeanCostTemplateSettingValue => {
  if (typeof value !== 'object' || value == null) {
    return null;
  }

  const record = value as Partial<BeanCostTemplateSettingValue>;

  if (record.costTemplateId != null && typeof record.costTemplateId !== 'string') {
    return null;
  }

  return {
    costTemplateId: record.costTemplateId ?? null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
};

const parseBeanGradeSettingValue = (value: unknown): null | BeanGradeSettingValue => {
  if (typeof value !== 'object' || value == null) {
    return null;
  }

  const record = value as Partial<BeanGradeSettingValue>;

  if (
    record.grade != null &&
    typeof record.grade !== 'string'
  ) {
    return null;
  }

  return {
    grade: normalizeText(record.grade),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
};

const buildInventoryOverviewRecordFromTables = (
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
    updated_at: [
      bean.updated_at,
      latestPurchaseBatch?.updated_at,
      defaultSaleSpec?.updated_at,
    ]
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => compareIsoDateDesc(left, right))[0] ?? bean.updated_at,
    variety: bean.variety,
    weighted_cost_per_kg: purchaseBatchTotals.weightedCostPerKg,
  };
};

export class MockBeanRepository implements BeanRepository {
  private readonly beans: Bean[];

  constructor(beans: Bean[] = beanCacheService.getBeans() ?? []) {
    this.beans = [...beans];
  }

  getBeanById(beanId: string | number): Promise<ApiResponse<Bean | null>> {
    return Promise.resolve(ok(this.beans.find((bean) => String(bean.id) === String(beanId)) ?? null));
  }

  adjustRemainingWeight(beanId: string | number, deltaGrams: number): Promise<ApiResponse<Bean>> {
    const bean = this.beans.find((item) => String(item.id) === String(beanId));

    if (!bean) {
      throw new AppError('未找到生豆记录。', { code: 'DATA' });
    }

    const nextStockKg = bean.stockKg - deltaGrams / 1000;

    if (nextStockKg < 0) {
      throw new AppError('剩余库存不足，无法记录本次烘焙。', { code: 'DATA' });
    }

    bean.stockKg = Number(nextStockKg.toFixed(1));
    bean.updatedAt = new Date().toISOString();

    return Promise.resolve(ok(bean));
  }

  getEditableBean(beanId: string | number): Promise<ApiResponse<GreenBeanEditableDetail>> {
    const bean = this.beans.find((item) => String(item.id) === String(beanId));

    if (!bean) {
      return Promise.reject(new AppError('未找到生豆记录。', { code: 'DATA' }));
    }

    return Promise.resolve(
      ok({
        beanId: String(bean.id),
        agingDays: bean.agingDays ?? 14,
        code: bean.code ?? '',
        costTemplateId: bean.costTemplateId ?? null,
        defaultRoastInputGrams: bean.defaultRoastInputGrams ?? 200,
        defaultSaleUnitPrice: bean.defaultSaleUnitPrice ?? 0,
        defaultSaleUnitWeightGrams: bean.defaultSaleUnitWeightGrams ?? 100,
        displayName: bean.name,
        flavorTags: bean.flavorTags ?? [],
        grade: bean.grade,
        harvestSeason: bean.harvestSeason ?? '',
        millName: null,
        notes: null,
        originArea: null,
        originCountry: bean.origin.split(' · ')[0] ?? '',
        originRegion: bean.origin.split(' · ')[1] ?? '',
        processMethod: bean.process,
        purchasedTotalPrice: Math.round(bean.costPerKg * bean.stockKg),
        purchasedWeightGrams: Math.round(bean.stockKg * 1000),
        remainingWeightGrams: Math.round(bean.stockKg * 1000),
        supplierName: bean.supplierName ?? null,
        tastingEndDays: bean.tastingEndDays ?? 40,
        variety: bean.variety ?? bean.grade,
        altitudeMetersMax: null,
        altitudeMetersMin: null,
        densityGPerL: null,
        moisturePercent: null,
      }),
    );
  }

  listBeans(): Promise<ApiResponse<Bean[]>> {
    beanCacheService.save(this.beans, 'mock');

    return Promise.resolve(ok(this.beans));
  }

  syncBeans(): Promise<ApiResponse<Bean[]>> {
    return this.listBeans();
  }

  updateBean(beanId: string | number): Promise<ApiResponse<Bean>> {
    const bean = this.beans.find((b) => String(b.id) === String(beanId));

    if (!bean) {
      throw new AppError('未找到生豆记录。', { code: 'DATA' });
    }

    // Mock 模式不支持真正更新，返回原记录
    return Promise.resolve(ok(bean));
  }

  deleteBean(): Promise<void> {
    // Mock 模式不支持删除
    return Promise.resolve();
  }
  createBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>> {
    const now = new Date().toISOString();
    const bean: Bean = {
      agingDays: input.agingDays,
      id: `mock-bean-${String(Date.now())}`,
      name: input.displayName.trim(),
      origin: [input.originCountry, input.originRegion, input.originArea].filter(Boolean).join(' · '),
      process: input.processMethod.trim(),
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

    this.beans.unshift(bean);
    beanCacheService.save(this.beans, 'mock');

    return Promise.resolve(ok(bean));
  }
}

export function createRemoteBeanRepository(
  client: RemoteBeanClient,
  tableName = 'beans',
): BeanRepository {
  return {
    async getBeanById(beanId) {
      const beans = await this.listBeans();

      return ok(beans.data.find((bean) => bean.id === beanId) ?? null);
    },
    getEditableBean() {
      return Promise.reject(new AppError('此仓库不支持编辑详情，请使用 PocketBaseRestClient 仓库。', {
        code: 'CONFIG',
      }));
    },
    adjustRemainingWeight() {
      return Promise.reject(new AppError('此仓库不支持库存调整，请使用 PocketBaseRestClient 仓库。', {
        code: 'CONFIG',
      }));
    },
    async listBeans() {
      const result = await client.from(tableName).select('*').order('created_at', { ascending: false });

      if (result.error) {
        throw new AppError(result.error.message, {
          code: 'NETWORK',
          cause: result.error,
        });
      }

      return ok((result.data ?? []).map(mapRemoteBeanRecordToBean));
    },
    syncBeans() {
      return this.listBeans();
    },
    updateBean(): Promise<ApiResponse<Bean>> {
      // createRemoteBeanRepository 使用兼容查询接口，暂不支持 update
      // 实际更新通过 createGreenBeanInventoryRepository 的 PocketBaseRestClient 完成
      return Promise.reject(new AppError('此仓库不支持更新，请使用 PocketBaseRestClient 仓库。', {
        code: 'CONFIG',
      }));
    },
    deleteBean(): Promise<void> {
      // 此仓库暂不支持删除
      return Promise.resolve();
    },
    createBean(): Promise<ApiResponse<Bean>> {
      return Promise.reject(new AppError('此仓库不支持创建，请使用 PocketBaseRestClient 仓库。', {
        code: 'CONFIG',
      }));
    },
  };
}

export function createGreenBeanInventoryRepository(
  client: PocketBaseRestClient,
  options: { tableName?: string; viewName?: string } = {},
): BeanRepository {
  const tableName = options.tableName ?? 'green_beans';
  void options.viewName;
  const OPTIONAL_COLLECTIONS = new Set(['app_settings', 'bean_sale_specs', 'roast_batches']);

  const isMissingOptionalCollectionError = (collectionName: string, error: unknown): boolean => {
    return (
      OPTIONAL_COLLECTIONS.has(collectionName) &&
      error instanceof AppError &&
      error.code === 'HTTP' &&
      error.status === 404
    );
  };

  const withOptionalCollectionFallback = async <T,>(
    collectionName: string,
    operation: string,
    execute: () => Promise<T>,
    fallback: T,
  ): Promise<T> => {
    try {
      return await execute();
    } catch (error) {
      if (isMissingOptionalCollectionError(collectionName, error)) {
        logger.warn('bean repository optional collection unavailable', {
          collectionName,
          error,
          operation,
        });
        return fallback;
      }

      throw error;
    }
  };

  const loadBeanSaleDefaultsRecordRaw = async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
    const rows = await client.list<RemoteAppSettingRecord>('app_settings', {
      limit: 1,
      match: { key: getBeanSaleDefaultsSettingKey(String(beanId)) },
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return rows[0] ?? null;
  };

  const loadBeanSaleDefaultsRecord = async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
    return withOptionalCollectionFallback(
      'app_settings',
      'load bean sale defaults',
      () => loadBeanSaleDefaultsRecordRaw(beanId),
      null,
    );
  };

  const loadBeanCostTemplateRecordRaw = async (
    beanId: string | number,
  ): Promise<null | RemoteAppSettingRecord> => {
    const rows = await client.list<RemoteAppSettingRecord>('app_settings', {
      limit: 1,
      match: { key: getBeanCostTemplateSettingKey(String(beanId)) },
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return rows[0] ?? null;
  };

  const loadBeanCostTemplateRecord = async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
    return withOptionalCollectionFallback(
      'app_settings',
      'load bean cost template',
      () => loadBeanCostTemplateRecordRaw(beanId),
      null,
    );
  };

  const loadBeanGradeRecordRaw = async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
    const rows = await client.list<RemoteAppSettingRecord>('app_settings', {
      limit: 1,
      match: { key: getBeanGradeSettingKey(String(beanId)) },
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return rows[0] ?? null;
  };

  const loadBeanGradeRecord = async (beanId: string | number): Promise<null | RemoteAppSettingRecord> => {
    return withOptionalCollectionFallback(
      'app_settings',
      'load bean grade',
      () => loadBeanGradeRecordRaw(beanId),
      null,
    );
  };

  const loadBeanSaleDefaultsMap = async (): Promise<Map<string, BeanSaleDefaultsSettingValue>> => {
    return withOptionalCollectionFallback('app_settings', 'load bean sale defaults map', async () => {
      const rows = await client.list<RemoteAppSettingRecord>('app_settings', {
        orderBy: {
          ascending: false,
          column: 'updated_at',
        },
      });
      const result = new Map<string, BeanSaleDefaultsSettingValue>();

      rows.forEach((row) => {
        if (!row.key.startsWith('green_bean_sale_defaults:')) {
          return;
        }

        const beanId = row.key.replace('green_bean_sale_defaults:', '');
        const parsedValue = parseBeanSaleDefaultsSettingValue(row.value);

        if (!beanId || !parsedValue || result.has(beanId)) {
          return;
        }

        result.set(beanId, parsedValue);
      });

      return result;
    }, new Map<string, BeanSaleDefaultsSettingValue>());
  };

  const loadBeanCostTemplateMap = async (): Promise<Map<string, BeanCostTemplateSettingValue>> => {
    return withOptionalCollectionFallback('app_settings', 'load bean cost template map', async () => {
      const rows = await client.list<RemoteAppSettingRecord>('app_settings', {
        orderBy: {
          ascending: false,
          column: 'updated_at',
        },
      });
      const result = new Map<string, BeanCostTemplateSettingValue>();

      rows.forEach((row) => {
        if (!row.key.startsWith('green_bean_cost_template:')) {
          return;
        }

        const beanId = row.key.replace('green_bean_cost_template:', '');
        const parsedValue = parseBeanCostTemplateSettingValue(row.value);

        if (!beanId || !parsedValue || result.has(beanId)) {
          return;
        }

        result.set(beanId, parsedValue);
      });

      return result;
    }, new Map<string, BeanCostTemplateSettingValue>());
  };

  const loadBeanGradeMap = async (): Promise<Map<string, BeanGradeSettingValue>> => {
    return withOptionalCollectionFallback('app_settings', 'load bean grade map', async () => {
      const rows = await client.list<RemoteAppSettingRecord>('app_settings', {
        orderBy: {
          ascending: false,
          column: 'updated_at',
        },
      });
      const result = new Map<string, BeanGradeSettingValue>();

      rows.forEach((row) => {
        if (!row.key.startsWith('green_bean_grade:')) {
          return;
        }

        const beanId = row.key.replace('green_bean_grade:', '');
        const parsedValue = parseBeanGradeSettingValue(row.value);

        if (!beanId || !parsedValue || result.has(beanId)) {
          return;
        }

        result.set(beanId, parsedValue);
      });

      return result;
    }, new Map<string, BeanGradeSettingValue>());
  };

  const saveBeanSaleDefaults = async (
    beanId: string | number,
    input: Pick<GreenBeanUpdateInput, 'defaultSaleUnitPrice' | 'defaultSaleUnitWeightGrams'>,
  ): Promise<void> => {
    await withOptionalCollectionFallback('app_settings', 'save bean sale defaults', async () => {
      const currentRecord = await loadBeanSaleDefaultsRecordRaw(beanId);
      const payload = {
        key: getBeanSaleDefaultsSettingKey(String(beanId)),
        value: {
          defaultSaleUnitPrice: input.defaultSaleUnitPrice,
          defaultSaleUnitWeightGrams: input.defaultSaleUnitWeightGrams ?? null,
          updatedAt: new Date().toISOString(),
        },
      };

      if (!currentRecord) {
        await client.insert('app_settings', payload);
        return;
      }

      await client.update('app_settings', payload, {
        match: { id: currentRecord.id },
        select: '*',
      });
    }, undefined);
  };

  const saveBeanCostTemplate = async (beanId: string | number, costTemplateId: null | string): Promise<void> => {
    await withOptionalCollectionFallback('app_settings', 'save bean cost template', async () => {
      const currentRecord = await loadBeanCostTemplateRecordRaw(beanId);
      const payload = {
        key: getBeanCostTemplateSettingKey(String(beanId)),
        value: {
          costTemplateId,
          updatedAt: new Date().toISOString(),
        },
      };

      if (!currentRecord) {
        await client.insert('app_settings', payload);
        return;
      }

      await client.update('app_settings', payload, {
        match: { id: currentRecord.id },
        select: '*',
      });
    }, undefined);
  };

  const saveBeanGrade = async (
    beanId: string | number,
    grade: null | string | undefined,
  ): Promise<void> => {
    await withOptionalCollectionFallback('app_settings', 'save bean grade', async () => {
      const currentRecord = await loadBeanGradeRecordRaw(beanId);
      const payload = {
        key: getBeanGradeSettingKey(String(beanId)),
        value: {
          grade: normalizeText(grade),
          updatedAt: new Date().toISOString(),
        },
      };

      if (!currentRecord) {
        await client.insert('app_settings', payload);
        return;
      }

      await client.update('app_settings', payload, {
        match: { id: currentRecord.id },
        select: '*',
      });
    }, undefined);
  };

  const listSaleSpecs = async (
    options?: Parameters<typeof client.list<RemoteSaleSpecRecord>>[1],
  ): Promise<RemoteSaleSpecRecord[]> => {
    return withOptionalCollectionFallback(
      'bean_sale_specs',
      'list bean sale specs',
      () => client.list<RemoteSaleSpecRecord>('bean_sale_specs', options),
      [],
    );
  };

  const listRoastBatches = async (): Promise<RemoteRoastBatchOverviewRecord[]> => {
    return withOptionalCollectionFallback(
      'roast_batches',
      'list roast batches for bean aggregation',
      () => client.list<RemoteRoastBatchOverviewRecord>('roast_batches'),
      [],
    );
  };

  const upsertOptionalDefaultSaleSpec = async (
    beanId: string | number,
    input: GreenBeanUpdateInput,
  ): Promise<void> => {
    await withOptionalCollectionFallback('bean_sale_specs', 'upsert default sale spec', async () => {
      if (input.defaultSaleUnitWeightGrams == null) {
        const existingSaleSpecs = await client.list<RemoteSaleSpecRecord>('bean_sale_specs', {
          match: { green_bean_id: beanId, is_default: true },
        });
        const defaultSaleSpec = getDefaultSaleSpecRecord(existingSaleSpecs);

        if (defaultSaleSpec) {
          await client.update('bean_sale_specs', {
            unit_price: input.defaultSaleUnitPrice,
          }, {
            match: { id: defaultSaleSpec.id },
            select: '*',
          });
        }

        return;
      }

      const existingSaleSpecs = await client.list<RemoteSaleSpecRecord>('bean_sale_specs', {
        match: { green_bean_id: beanId, is_default: true },
      });
      const defaultSaleSpec = getDefaultSaleSpecRecord(existingSaleSpecs);

      if (!defaultSaleSpec) {
        await client.insert('bean_sale_specs', {
          channel: 'default',
          green_bean_id: beanId,
          is_default: true,
          unit_price: input.defaultSaleUnitPrice,
          unit_weight_grams: input.defaultSaleUnitWeightGrams,
        });
        return;
      }

      await client.update('bean_sale_specs', {
        unit_price: input.defaultSaleUnitPrice,
        unit_weight_grams: input.defaultSaleUnitWeightGrams,
      }, {
        match: { id: defaultSaleSpec.id },
        select: '*',
      });
    }, undefined);
  };

  const loadInventoryOverviewRecordsFromTables = async (): Promise<RemoteGreenBeanInventoryRecord[]> => {
    const [beans, purchaseBatches, saleSpecs, roastBatches, savedSaleDefaultsMap, savedCostTemplateMap, savedGradeMap] = await Promise.all([
      client.list<RemoteGreenBeanRecord>(tableName, {
        orderBy: {
          ascending: false,
          column: 'created_at',
        },
      }),
      client.list<RemotePurchaseBatchRecord>('green_bean_purchase_batches'),
      listSaleSpecs(),
      listRoastBatches(),
      loadBeanSaleDefaultsMap(),
      loadBeanCostTemplateMap(),
      loadBeanGradeMap(),
    ]);

    const purchaseBatchMap = new Map<string, RemotePurchaseBatchRecord[]>();
    const saleSpecMap = new Map<string, RemoteSaleSpecRecord[]>();
    const roastBatchMap = new Map<string, RemoteRoastBatchOverviewRecord[]>();

    purchaseBatches.forEach((batch) => {
      if (!batch.green_bean_id) {
        return;
      }

      const current = purchaseBatchMap.get(batch.green_bean_id) ?? [];
      current.push(batch);
      purchaseBatchMap.set(batch.green_bean_id, current);
    });

    saleSpecs.forEach((saleSpec) => {
      if (!saleSpec.green_bean_id) {
        return;
      }

      const current = saleSpecMap.get(saleSpec.green_bean_id) ?? [];
      current.push(saleSpec);
      saleSpecMap.set(saleSpec.green_bean_id, current);
    });

    roastBatches.forEach((roastBatch) => {
      const current = roastBatchMap.get(roastBatch.green_bean_id) ?? [];
      current.push(roastBatch);
      roastBatchMap.set(roastBatch.green_bean_id, current);
    });

    return beans.map((bean) =>
      buildInventoryOverviewRecordFromTables(
        bean,
        purchaseBatchMap.get(bean.id) ?? [],
        saleSpecMap.get(bean.id) ?? [],
        (roastBatchMap.get(bean.id) ?? []).length,
        savedSaleDefaultsMap.get(bean.id) ?? null,
        savedCostTemplateMap.get(bean.id) ?? null,
        savedGradeMap.get(bean.id) ?? null,
      ),
    );
  };

  const getLatestInventoryBean = async (beanId: string | number): Promise<Bean> => {
    const overviewRecords = await loadInventoryOverviewRecordsFromTables();
    const record = overviewRecords.find((item) => item.id === String(beanId));

    if (!record) {
      throw new AppError('未找到最新的生豆库存数据。', { code: 'DATA' });
    }

    return mapRemoteGreenBeanInventoryRecordToBean(record);
  };

  const getEditableBeanDetail = async (beanId: string | number): Promise<GreenBeanEditableDetail> => {
    const beanRows = await client.list<RemoteGreenBeanRecord>(tableName, {
      limit: 1,
      match: { id: beanId },
    });

    if (beanRows.length === 0) {
      throw new AppError('未找到生豆主档。', { code: 'DATA' });
    }

    const purchaseRows = await client.list<RemotePurchaseBatchRecord>('green_bean_purchase_batches', {
      match: { green_bean_id: beanId },
    });

    const saleSpecRows = await listSaleSpecs({
      match: { green_bean_id: beanId, is_default: true },
    });
    const savedSaleDefaults = parseBeanSaleDefaultsSettingValue((await loadBeanSaleDefaultsRecord(beanId))?.value);
    const savedCostTemplate = parseBeanCostTemplateSettingValue((await loadBeanCostTemplateRecord(beanId))?.value);
    const savedGrade = parseBeanGradeSettingValue((await loadBeanGradeRecord(beanId))?.value);

    const beanRow = beanRows[0];

    if (!beanRow) {
      throw new AppError('未找到生豆主档。', { code: 'DATA' });
    }

    return mapRemoteEditableBeanToFormInput(
      beanRow,
      getLatestPurchaseBatchRecord(purchaseRows),
      getDefaultSaleSpecRecord(saleSpecRows),
      savedSaleDefaults,
      savedCostTemplate,
      savedGrade,
    );
  };

  const upsertLatestPurchaseBatch = async (
    beanId: string | number,
    input: GreenBeanUpdateInput,
  ): Promise<void> => {
    const payload: EditablePurchaseBatchInput = {
      purchased_total_price: input.purchasedTotalPrice,
      purchased_weight_grams: input.purchasedWeightGrams,
      remaining_weight_grams: normalizeRemainingWeightGrams(input),
      supplier_name: normalizeText(input.supplierName),
    };

    const latestBatchRows = await client.list<RemotePurchaseBatchRecord>('green_bean_purchase_batches', {
      match: { green_bean_id: beanId },
    });

    const latestBatch = getLatestPurchaseBatchRecord(latestBatchRows);

    if (!latestBatch) {
      await client.insert('green_bean_purchase_batches', {
        green_bean_id: beanId,
        purchased_total_price: payload.purchased_total_price,
        purchased_weight_grams: payload.purchased_weight_grams,
        received_at: new Date().toISOString().slice(0, 10),
        remaining_weight_grams: payload.remaining_weight_grams,
        supplier_name: payload.supplier_name ?? null,
      });
      return;
    }

    await client.update('green_bean_purchase_batches', {
      ...payload,
      remaining_weight_grams: payload.remaining_weight_grams,
    }, {
      match: { id: latestBatch.id },
      select: '*',
    });
  };

  return {
    async getBeanById(beanId) {
      const beans = await this.listBeans();

      return ok(beans.data.find((bean) => String(bean.id) === String(beanId)) ?? null);
    },
    async adjustRemainingWeight(beanId, deltaGrams) {
      const purchaseRows = await client.list<RemotePurchaseBatchRecord>('green_bean_purchase_batches', {
        match: { green_bean_id: beanId },
      });

      const latestBatch = getLatestPurchaseBatchRecord(purchaseRows);

      if (!latestBatch) {
        throw new AppError('当前生豆缺少采购批次，无法更新剩余库存。', { code: 'DATA' });
      }

      const nextRemainingWeight = latestBatch.remaining_weight_grams - deltaGrams;

      if (nextRemainingWeight < 0) {
        throw new AppError('剩余库存不足，无法记录本次烘焙。', { code: 'DATA' });
      }

      await client.update('green_bean_purchase_batches', {
        remaining_weight_grams: Math.min(nextRemainingWeight, latestBatch.purchased_weight_grams),
      }, {
        match: { id: latestBatch.id },
        select: '*',
      });

      const bean = await getLatestInventoryBean(beanId);

      beanCacheService.save([bean], 'remote');

      return ok(bean);
    },
    async getEditableBean(beanId) {
      return ok(await getEditableBeanDetail(beanId));
    },
    async listBeans() {
      const rows = await loadInventoryOverviewRecordsFromTables();

      const beans = rows
        .sort((left, right) => compareIsoDateDesc(left.created_at, right.created_at))
        .map((record) => mapRemoteGreenBeanInventoryRecordToBean(record));

      beanCacheService.save(beans, 'remote');

      return ok(beans);
    },
    async syncBeans() {
      return this.listBeans();
    },
    async updateBean(beanId, input) {
      const rows = await client.update(tableName, mapBeanFormInputToTableInput(input) as Record<string, unknown>, {
        match: { id: beanId },
        select: '*',
      });

      if (rows.length === 0) {
        throw new AppError('更新失败：未找到记录。', { code: 'DATA' });
      }

      await saveBeanGrade(beanId, input.grade);
      await saveBeanCostTemplate(beanId, input.costTemplateId ?? null);
      await upsertLatestPurchaseBatch(beanId, input);
      await upsertOptionalDefaultSaleSpec(beanId, input);
      await saveBeanSaleDefaults(beanId, input);

      const bean = await getLatestInventoryBean(beanId);

      beanCacheService.save([bean], 'remote');

      return ok(bean);
    },
    async deleteBean(beanId) {
      // 按外键依赖顺序删除关联数据（避免 409 Conflict）
      // roast_batches 同样引用 green_beans，必须先清理，否则 green_beans 会因 restrict 删除失败
      await client.delete('roast_batches', { match: { green_bean_id: beanId } });
      // purchase_batches 和 roast_records 对 green_beans 是 ON DELETE RESTRICT
      await client.delete('green_bean_purchase_batches', { match: { green_bean_id: beanId } });
      await client.delete('roast_records', { match: { green_bean_id: beanId } });
      // roast_profiles 和 bean_sale_specs 是 ON DELETE CASCADE，但显式删除更安全
      await client.delete('roast_profiles', { match: { green_bean_id: beanId } });
      await client.delete('bean_sale_specs', { match: { green_bean_id: beanId } });
      // 最后删除生豆本身
      await client.delete(tableName, { match: { id: beanId } });
    },
    async createBean(input) {
      const greenBeanPayload: Record<string, unknown> = {
        aging_days: Math.max(0, Math.round(input.agingDays)),
        code: input.code.trim(),
        default_roast_input_grams: input.defaultRoastInputGrams,
        display_name: input.displayName.trim(),
        flavor_tags: serializeFlavorTags(input.flavorTags),
        grade: normalizeText(input.grade),
        harvest_season: normalizeText(input.harvestSeason),
        notes: normalizeText(input.notes),
        origin_area: normalizeText(input.originArea),
        origin_country: normalizeText(input.originCountry),
        origin_region: normalizeText(input.originRegion),
        process_method: input.processMethod.trim(),
        tasting_end_days: Math.max(1, Math.round(input.tastingEndDays)),
        variety: input.variety.trim(),
      };

      if (input.altitudeMetersMin != null) {
        greenBeanPayload.altitude_meters_min = input.altitudeMetersMin;
      }

      if (input.altitudeMetersMax != null) {
        greenBeanPayload.altitude_meters_max = input.altitudeMetersMax;
      }

      if (input.moisturePercent != null) {
        greenBeanPayload.moisture_percent = input.moisturePercent;
      }

      if (input.densityGPerL != null) {
        greenBeanPayload.density_g_per_l = input.densityGPerL;
      }

      if (normalizeText(input.millName) != null) {
        greenBeanPayload.mill_name = normalizeText(input.millName);
      }

      const insertedBeans = await client.insert<{ id: string }>(
        tableName,
        greenBeanPayload,
        { select: '*' },
      );

      if (insertedBeans.length === 0) {
        throw new AppError('创建生豆失败：未返回数据。', { code: 'DATA' });
      }

      const insertedBean = insertedBeans[0];

      if (!insertedBean || typeof insertedBean.id !== 'string') {
        throw new AppError('创建生豆失败：缺少主键。', { code: 'DATA' });
      }

      const newBeanId = insertedBean.id;

      await saveBeanGrade(newBeanId, input.grade);
      await saveBeanCostTemplate(newBeanId, input.costTemplateId ?? null);
      await upsertLatestPurchaseBatch(newBeanId, input);
      await upsertOptionalDefaultSaleSpec(newBeanId, input);
      await saveBeanSaleDefaults(newBeanId, input);

      const bean = await getLatestInventoryBean(newBeanId);

      beanCacheService.save([bean], 'remote');

      return ok(bean);
    },
  };
}

const hasGreenBeanConnection = (): boolean => {
  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');

  return isPocketBaseProjectConnectionConfigured(connection);
};

export const resolveBeanRepository = (): BeanRepository => {
  if (import.meta.env.MODE === 'test') {
    logger.info('bean repository: mock (test mode)');
    return new MockBeanRepository();
  }

  if (!hasGreenBeanConnection()) {
    logger.info('bean repository: mock (missing connection)');
    return new MockBeanRepository();
  }

  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');
  const client = new PocketBaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });

  logger.info('bean repository: remote', {
    projectUrl: connection.projectUrl,
  });
  return createGreenBeanInventoryRepository(client);
};

export const beanService = {
  getBootstrappedBeans,
  createOptimisticBean(input: GreenBeanCreateInput): Bean {
    const localRecord = localGreenBeanService.create(input);
    return mapLocalGreenBeanRecordToBean(localRecord);
  },
  prepareOptimisticDelete(beanId: Bean['id']): {
    cacheBeans: Bean[] | null;
    cacheSource: 'mock' | 'remote' | null;
    localRecord: LocalGreenBeanRecord | null;
  } {
    const cacheBeans = beanCacheService.getBeans();
    const cacheStatus = beanCacheService.getStatus();
    const beanIdString = String(beanId);
    const localRecord =
      beanIdString.startsWith('local-') ? localGreenBeanService.findRecordById(beanIdString) : null;

    if (cacheBeans) {
      const nextCacheBeans = cacheBeans.filter((bean) => String(bean.id) !== beanIdString);
      beanCacheService.save(nextCacheBeans, cacheStatus.source ?? 'remote');
    }

    if (localRecord) {
      localGreenBeanService.removeById(beanIdString);
    }

    return {
      cacheBeans,
      cacheSource: cacheStatus.source,
      localRecord,
    };
  },
  rollbackOptimisticDelete(snapshot: {
    cacheBeans: Bean[] | null;
    cacheSource: 'mock' | 'remote' | null;
    localRecord: LocalGreenBeanRecord | null;
  }): Bean[] {
    if (snapshot.cacheBeans) {
      beanCacheService.save(snapshot.cacheBeans, snapshot.cacheSource ?? 'remote');
    }

    if (snapshot.localRecord) {
      localGreenBeanService.restore(snapshot.localRecord);
    }

    return getBootstrappedBeans();
  },
  finalizeOptimisticBean(optimisticBeanId: string, remoteBean: Bean): Bean[] {
    localGreenBeanService.removeById(optimisticBeanId);
    const nextBeans = mergeBeans([remoteBean]);

    beanCacheService.save(nextBeans.filter((bean) => !String(bean.id).startsWith('local-')), 'remote');

    return nextBeans;
  },
  rollbackOptimisticBean(optimisticBeanId: string): Bean[] {
    localGreenBeanService.removeById(optimisticBeanId);

    return mergeBeans(beanCacheService.getBeans() ?? []);
  },
  persistOptimisticBeanAsPending(input: GreenBeanCreateInput): Bean[] {
    beanSyncService.recordPendingCreate(input);
    const normalizedCode = input.code.trim();
    const existingLocalRecord = localGreenBeanService
      .listRecords()
      .find((record) => record.code === normalizedCode);
    const localRecord = existingLocalRecord ?? localGreenBeanService.create(input);

    return mergeBeans([
      ...(beanCacheService.getBeans() ?? []),
      mapLocalGreenBeanRecordToBean(localRecord),
    ]);
  },
  async createRemoteBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>> {
    if (!beanSyncService.isOnline()) {
      throw new AppError('当前网络不可用，无法同步到 PocketBase。', { code: 'NETWORK' });
    }

    return resolveBeanRepository().createBean(input);
  },
  async createBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>> {
    // 在线且已配置远端主库：直接同步到远端主库
    if (beanSyncService.isOnline()) {
      try {
        const repo = resolveBeanRepository();
        const response = await repo.createBean(input);

        // 同步成功后，清理可能存在的同 code 本地残留记录（避免双卡）
        localGreenBeanService.removeByCode(input.code.trim());

        return response;
      } catch (error) {
        logger.warn('bean create failed, fallback to local', { error });
        // 降级：如果在线创建失败，存本地并记录 pending
      }
    }

    // 离线或在线创建失败：存本地并记录 pending
    const localRecord = localGreenBeanService.create(input);
    beanSyncService.recordPendingCreate(input);

    return ok(mapLocalGreenBeanRecordToBean(localRecord));
  },
  async adjustRemainingWeight(beanId: string | number, deltaGrams: number): Promise<ApiResponse<Bean>> {
    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      const updatedRecord = localGreenBeanService.adjustRemainingWeight(beanId, deltaGrams);
      return ok(mapLocalGreenBeanRecordToBean(updatedRecord));
    }

    if (!beanSyncService.isOnline()) {
      throw new AppError('当前离线，无法更新生豆剩余库存，请联网后再试。', { code: 'NETWORK' });
    }

    return resolveBeanRepository().adjustRemainingWeight(beanId, deltaGrams);
  },
  async getEditableBean(beanId: string | number): Promise<ApiResponse<GreenBeanEditableDetail>> {
    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      const localRecord = localGreenBeanService.listRecords().find((record) => record.id === beanId);

      if (!localRecord) {
        throw new AppError('未找到本地生豆记录。', { code: 'DATA' });
      }

      return ok({
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
    }

    return resolveBeanRepository().getEditableBean(beanId);
  },
  async getBeanById(beanId: string | number): Promise<ApiResponse<Bean | null>> {
    const response = await this.listBeans();

    return ok(response.data.find((bean) => String(bean.id) === String(beanId)) ?? null);
  },
  async listBeans(): Promise<ApiResponse<Bean[]>> {
    try {
      const response = await resolveBeanRepository().listBeans();

      return ok(mergeBeans(response.data));
    } catch (error) {
      if (error instanceof AppError) {
        if (error.code === 'AUTH' || error.code === 'CONFIG' || error.code === 'DATA') {
          beanCacheService.markFailure(error.code);
          throw error;
        }

        const cachedBeans = beanCacheService.markFallback(error.code);

        if (cachedBeans) {
          return ok(mergeBeans(cachedBeans));
        }

        beanCacheService.markFailure(error.code);

        const localBeans = localGreenBeanService.listBeans();

        if (localBeans.length > 0) {
          return ok(mergeBeans([]));
        }
      }

      throw error;
    }
  },
  async syncLocalAndRemote(): Promise<{ downloaded: number; uploaded: number }> {
    if (!beanSyncService.isOnline()) {
      return { downloaded: 0, uploaded: 0 };
    }

    const repository = resolveBeanRepository();
    const localRecords = localGreenBeanService.listRecords();
    let uploaded = 0;

    if (localRecords.length > 0) {
      const remoteBeforeSync = await repository.listBeans();
      const remoteCodes = new Set(
        remoteBeforeSync.data
          .map((bean) => bean.code?.trim())
          .filter((code): code is string => Boolean(code)),
      );

      for (const record of localRecords) {
        const normalizedCode = record.code.trim();

        if (normalizedCode.length === 0) {
          continue;
        }

        if (remoteCodes.has(normalizedCode)) {
          localGreenBeanService.removeByCode(normalizedCode);
          continue;
        }

        await repository.createBean(beanSyncService.localRecordToCreateInput(record));
        localGreenBeanService.removeByCode(normalizedCode);
        remoteCodes.add(normalizedCode);
        uploaded += 1;
      }
    }

    const remoteAfterSync = await repository.listBeans();
    const bootstrappedBeforeSync = getBootstrappedBeans();
    const mergedRemoteBeans = mergeBeans(remoteAfterSync.data);

    beanCacheService.save(remoteAfterSync.data, 'remote');

    const beforeSignature = JSON.stringify(
      bootstrappedBeforeSync.map((bean) => `${String(bean.id)}:${bean.updatedAt}`),
    );
    const afterSignature = JSON.stringify(
      mergedRemoteBeans.map((bean) => `${String(bean.id)}:${bean.updatedAt}`),
    );

    return {
      downloaded: beforeSignature === afterSignature ? 0 : mergedRemoteBeans.length,
      uploaded,
    };
  },
  syncBeans(): Promise<ApiResponse<Bean[]>> {
    return this.listBeans();
  },
  async updateBean(beanId: string | number, input: GreenBeanUpdateInput): Promise<ApiResponse<Bean>> {
    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      const updatedRecord = localGreenBeanService.update(beanId, input);
      return ok(mapLocalGreenBeanRecordToBean(updatedRecord));
    }

    // 在线且已配置远端主库：直接同步到远端主库
    if (beanSyncService.isOnline()) {
      try {
        return await resolveBeanRepository().updateBean(beanId, input);
      } catch (error) {
        logger.warn('bean update failed, fallback to pending queue', { error });
      }
    }

    // 离线或在线更新失败：记录 pending update
    beanSyncService.recordPendingUpdate(beanId, input);

    // 尝试从本地缓存更新（如果可能）
    throw new AppError('当前处于离线状态，更新已记录，将在联网后同步。', {
      code: 'NETWORK',
    });
  },
  async deleteBean(beanId: string | number): Promise<{ queued: boolean; synced: boolean }> {
    // 在线且已配置远端主库：直接同步到远端主库
    if (beanSyncService.isOnline()) {
      try {
        await resolveBeanRepository().deleteBean(beanId);
        return { queued: false, synced: true };
      } catch (error) {
        logger.warn('bean delete failed, fallback to pending queue', { error });
      }
    }

    // 离线或在线删除失败：记录 pending delete
    // 如果是本地 ID（local- 开头），直接从本地存储中删除
    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      localGreenBeanService.removeById(beanId);
      return { queued: false, synced: true };
    } else {
      beanSyncService.recordPendingDelete(beanId);
      return { queued: true, synced: false };
    }
  },
  /**
   * 同步所有待处理操作到远端主库
   * 在网络恢复时调用
   */
  async syncPendingOperations(): Promise<{ failed: number; success: number }> {
    const pendingOps = beanSyncService.getPendingOperations();
    if (pendingOps.length === 0) {
      return { failed: 0, success: 0 };
    }

    const repo = resolveBeanRepository();
    let success = 0;
    let failed = 0;

    for (const op of pendingOps) {
      try {
        if (op.type === 'create') {
          const input = beanSyncService.localRecordToCreateInput(op.payload);
          try {
            await repo.createBean(input);
          } catch (createError) {
            // 409 Conflict = 该生豆已存在于远端主库（可能之前已同步成功）
            // 静默清理本地记录和待同步条目，不算失败
            const errMsg =
              createError instanceof Error ? createError.message : String(createError);
            if (errMsg.includes('409') || errMsg.includes('duplicate') || errMsg.includes('Conflict')) {
              logger.info('bean pending create already exists remotely', { opId: op.id });
              localGreenBeanService.removeByCode(input.code.trim());
              beanSyncService.removePendingOp(op.id);
              success++;
              continue;
            }
            throw createError;
          }
          // 创建同步成功：清除对应的本地记录（避免双卡）
          localGreenBeanService.removeByCode(input.code.trim());
        } else if (op.type === 'update') {
          const { beanId, ...input } = op.payload;
          await repo.updateBean(beanId as string | number, beanSyncService.localRecordToCreateInput(input));
        } else {
          const { beanId } = op.payload;
          await repo.deleteBean(beanId as string | number);
        }
        beanSyncService.removePendingOp(op.id);
        success++;
      } catch (error) {
        logger.error('bean pending operation sync failed', {
          error,
          opId: op.id,
          type: op.type,
        });
        failed++;
      }
    }

    return { failed, success };
  },
};
