import { beanCacheService } from '@/modules/bean/services/beanCache.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import { localGreenBeanService } from '@/modules/bean/services/localGreenBean.service';
import { supabaseConnectionSettingsService } from '@/modules/settings/services/supabaseConnectionSettings.service';
import { logger } from '@/shared/logger/logger';
import { AppError } from '@/shared/errors/AppError';
import type { ApiResponse } from '@/services/api.types';
import { SupabaseRestClient } from '@/services/supabaseRestClient';
import type { Bean } from '@/types/domain';

import type { GreenBeanCreateInput, GreenBeanEditableDetail, GreenBeanUpdateInput, LocalGreenBeanRecord } from '../types';

interface GreenBeanTableUpdateInput {
  altitude_meters_max?: null | number;
  altitude_meters_min?: null | number;
  code?: string;
  default_roast_input_grams?: number;
  density_g_per_l?: null | number;
  display_name?: string;
  harvest_season?: null | string;
  mill_name?: null | string;
  moisture_percent?: null | number;
  notes?: null | string;
  origin_area?: null | string;
  origin_country?: null | string;
  origin_region?: null | string;
  process_method?: string;
  variety?: string;
}

interface EditablePurchaseBatchInput {
  purchased_total_price: number;
  purchased_weight_grams: number;
  supplier_name?: null | string;
}

interface EditableSaleSpecInput {
  unit_price: number;
  unit_weight_grams?: null | number;
}

export interface BeanRepository {
  createBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>>;
  getEditableBean(beanId: string | number): Promise<ApiResponse<GreenBeanEditableDetail>>;
  getBeanById(beanId: string | number): Promise<ApiResponse<Bean | null>>;
  listBeans(): Promise<ApiResponse<Bean[]>>;
  syncBeans(): Promise<ApiResponse<Bean[]>>;
  updateBean(beanId: string | number, input: GreenBeanUpdateInput): Promise<ApiResponse<Bean>>;
  deleteBean(beanId: string | number): Promise<void>;
}

export interface SupabaseBeanRecord {
  id: number;
  name: string;
  origin: string;
  process: string;
  grade: string;
  stock_kg: number;
  cost_per_kg: number;
  supplier_id: number;
  created_at: string;
  updated_at: string;
}

interface SupabaseGreenBeanInventoryRecord {
  id: string;
  code: string;
  created_at: string;
  default_roast_input_grams: number;
  default_sale_unit_price: null | number;
  default_sale_unit_weight_grams: null | number;
  display_name: string;
  harvest_season: string;
  latest_supplier_name?: null | string;
  origin_area: null | string;
  origin_country: string;
  origin_region: string;
  process_method: string;
  roast_record_count: number;
  total_purchased_weight_grams: number;
  total_remaining_weight_grams: number;
  updated_at: string;
  variety: string;
  weighted_cost_per_kg: number;
}

interface SupabaseGreenBeanRecord {
  altitude_meters_max: null | number;
  altitude_meters_min: null | number;
  code: string;
  default_roast_input_grams: number;
  density_g_per_l: null | number;
  display_name: string;
  harvest_season: null | string;
  id: string;
  mill_name: null | string;
  moisture_percent: null | number;
  notes: null | string;
  origin_area: null | string;
  origin_country: null | string;
  origin_region: null | string;
  process_method: string;
  variety: string;
}

interface SupabasePurchaseBatchRecord {
  id: string;
  purchased_total_price: number;
  purchased_weight_grams: number;
  remaining_weight_grams: number;
  supplier_name: null | string;
}

interface SupabaseSaleSpecRecord {
  id: string;
  unit_price: number;
  unit_weight_grams: number;
}

interface SupabaseErrorLike {
  message: string;
}

interface SupabaseQueryResult<T> {
  data: T[] | null;
  error: SupabaseErrorLike | null;
}

interface SupabaseBeanSelectBuilder {
  order(column: string, options?: { ascending?: boolean }): Promise<SupabaseQueryResult<SupabaseBeanRecord>>;
}

interface SupabaseBeanTable {
  select(columns: string): SupabaseBeanSelectBuilder;
}

export interface SupabaseBeanClient {
  from(tableName: string): SupabaseBeanTable;
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
  return value == null ? null : value;
};

const mapBeanFormInputToTableInput = (input: GreenBeanUpdateInput): GreenBeanTableUpdateInput => ({
  altitude_meters_max: toNullableNumber(input.altitudeMetersMax),
  altitude_meters_min: toNullableNumber(input.altitudeMetersMin),
  code: input.code.trim(),
  default_roast_input_grams: input.defaultRoastInputGrams,
  density_g_per_l: toNullableNumber(input.densityGPerL),
  display_name: input.displayName.trim(),
  harvest_season: normalizeText(input.harvestSeason),
  mill_name: normalizeText(input.millName),
  moisture_percent: toNullableNumber(input.moisturePercent),
  notes: normalizeText(input.notes),
  origin_area: normalizeText(input.originArea),
  origin_country: normalizeText(input.originCountry),
  origin_region: normalizeText(input.originRegion),
  process_method: input.processMethod.trim(),
  variety: input.variety.trim(),
});

const mergeBeans = (beans: Bean[]): Bean[] => {
  const mergedMap = new Map<string, Bean>();

  // 第一遍：按 ID 合并（Supabase 记录优先）
  [...beans, ...localGreenBeanService.listBeans()].forEach((bean) => {
    const key = String(bean.id);
    const existing = mergedMap.get(key);
    // 非本地记录（来自 Supabase）优先于本地记录
    if (!existing || (existing.id.toString().startsWith('local-') && !key.startsWith('local-'))) {
      mergedMap.set(key, bean);
    }
  });

  // 第二遍：按名称去重本地残留（Supabase 已有的生豆，本地同名的不应再显示）
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
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
};

export const mapSupabaseBeanRecordToBean = (record: SupabaseBeanRecord): Bean => ({
  id: record.id,
  name: record.name,
  origin: record.origin,
  process: record.process,
  grade: record.grade,
  stockKg: record.stock_kg,
  costPerKg: record.cost_per_kg,
  supplierId: record.supplier_id,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

export const mapSupabaseGreenBeanInventoryRecordToBean = (
  record: SupabaseGreenBeanInventoryRecord,
): Bean => ({
  id: record.id,
  name: record.display_name,
  origin: [record.origin_country, record.origin_region, record.origin_area].filter(Boolean).join(' · '),
  process: record.process_method,
  // TODO: 数据库缺少 grade 字段，暂时使用默认值
  // 应该在 green_beans 表中添加 grade 字段
  grade: 'A',
  stockKg: Number((record.total_remaining_weight_grams / 1000).toFixed(1)),
  costPerKg: record.weighted_cost_per_kg,
  supplierName: record.latest_supplier_name ?? null,
  createdAt: record.created_at ?? record.updated_at,
  updatedAt: record.updated_at,
  // 扩展字段：提供更多信息
  variety: record.variety,
  harvestSeason: record.harvest_season,
  code: record.code,
  defaultRoastInputGrams: record.default_roast_input_grams,
  defaultSaleUnitPrice: record.default_sale_unit_price,
  defaultSaleUnitWeightGrams: record.default_sale_unit_weight_grams,
});

const mapSupabaseEditableBeanToFormInput = (
  bean: SupabaseGreenBeanRecord,
  latestPurchaseBatch: null | SupabasePurchaseBatchRecord,
  defaultSaleSpec: null | SupabaseSaleSpecRecord,
): GreenBeanEditableDetail => ({
  beanId: bean.id,
  code: bean.code,
  defaultRoastInputGrams: bean.default_roast_input_grams,
  defaultSaleSpecId: defaultSaleSpec?.id ?? null,
  defaultSaleUnitPrice: defaultSaleSpec?.unit_price ?? 0,
  defaultSaleUnitWeightGrams: defaultSaleSpec?.unit_weight_grams ?? null,
  displayName: bean.display_name,
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
  remainingWeightGrams: latestPurchaseBatch?.remaining_weight_grams ?? null,
  supplierName: latestPurchaseBatch?.supplier_name ?? null,
  variety: bean.variety,
  altitudeMetersMax: bean.altitude_meters_max,
  altitudeMetersMin: bean.altitude_meters_min,
  densityGPerL: bean.density_g_per_l,
  moisturePercent: bean.moisture_percent,
});

export class MockBeanRepository implements BeanRepository {
  private readonly beans: Bean[];

  constructor(beans: Bean[] = []) {
    this.beans = beans;
  }

  getBeanById(beanId: string | number): Promise<ApiResponse<Bean | null>> {
    return Promise.resolve(ok(this.beans.find((bean) => String(bean.id) === String(beanId)) ?? null));
  }

  getEditableBean(beanId: string | number): Promise<ApiResponse<GreenBeanEditableDetail>> {
    const bean = this.beans.find((item) => String(item.id) === String(beanId));

    if (!bean) {
      return Promise.reject(new AppError('未找到生豆记录。', { code: 'DATA' }));
    }

    return Promise.resolve(
      ok({
        beanId: String(bean.id),
        code: bean.code ?? '',
        defaultRoastInputGrams: bean.defaultRoastInputGrams ?? 200,
        defaultSaleUnitPrice: bean.defaultSaleUnitPrice ?? 0,
        defaultSaleUnitWeightGrams: bean.defaultSaleUnitWeightGrams ?? 100,
        displayName: bean.name,
        harvestSeason: bean.harvestSeason ?? '',
        millName: null,
        notes: null,
        originArea: null,
        originCountry: bean.origin.split(' · ')[0] ?? '',
        originRegion: bean.origin.split(' · ')[1] ?? '',
        processMethod: bean.process,
        purchasedTotalPrice: Math.round(bean.costPerKg * bean.stockKg),
        purchasedWeightGrams: Math.round(bean.stockKg * 1000),
        supplierName: bean.supplierName ?? null,
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

  async syncBeans(): Promise<ApiResponse<Bean[]>> {
    return this.listBeans();
  }

  async updateBean(beanId: string | number, _input: GreenBeanUpdateInput): Promise<ApiResponse<Bean>> {
    const bean = this.beans.find((b) => String(b.id) === String(beanId));

    if (!bean) {
      throw new AppError('未找到生豆记录。', { code: 'DATA' });
    }

    // Mock 模式不支持真正更新，返回原记录
    return ok(bean);
  }

  async deleteBean(_beanId: string | number): Promise<void> {
    // Mock 模式不支持删除
  }
  async createBean(_input: GreenBeanCreateInput): Promise<ApiResponse<Bean>> {
    throw new AppError('Mock 仓库不支持创建。', { code: 'CONFIG' });
  }
}

export function createSupabaseBeanRepository(
  client: SupabaseBeanClient,
  tableName = 'beans',
): BeanRepository {
  return {
    async getBeanById(beanId) {
      const beans = await this.listBeans();

      return ok(beans.data.find((bean) => bean.id === beanId) ?? null);
    },
    async getEditableBean() {
      throw new AppError('此仓库不支持编辑详情，请使用 SupabaseRestClient 仓库。', {
        code: 'CONFIG',
      });
    },
    async listBeans() {
      const result = await client.from(tableName).select('*').order('updated_at', { ascending: false });

      if (result.error) {
        throw new AppError(result.error.message, {
          code: 'NETWORK',
          cause: result.error,
        });
      }

      return ok((result.data ?? []).map(mapSupabaseBeanRecordToBean));
    },
    async syncBeans() {
      return this.listBeans();
    },
    async updateBean(_beanId: number, _input: GreenBeanUpdateInput): Promise<ApiResponse<Bean>> {
      // createSupabaseBeanRepository 使用 Supabase JS SDK，暂不支持 update
      // 实际更新通过 createSupabaseGreenBeanInventoryRepository 的 SupabaseRestClient 完成
      throw new AppError('此仓库不支持更新，请使用 SupabaseRestClient 仓库。', {
        code: 'CONFIG',
      });
    },
    async deleteBean(_beanId: string | number): Promise<void> {
      // 此仓库暂不支持删除
    },
    async createBean(_input: GreenBeanCreateInput): Promise<ApiResponse<Bean>> {
      throw new AppError('此仓库不支持创建，请使用 SupabaseRestClient 仓库。', {
        code: 'CONFIG',
      });
    },
  };
}

export function createSupabaseGreenBeanInventoryRepository(
  client: SupabaseRestClient,
  options: { tableName?: string; viewName?: string } = {},
): BeanRepository {
  const tableName = options.tableName ?? 'green_beans';
  const viewName = options.viewName ?? 'green_bean_inventory_overview';

  const getLatestInventoryBean = async (beanId: string | number): Promise<Bean> => {
    const viewRows = await client.list<SupabaseGreenBeanInventoryRecord>(viewName, {
      match: { id: beanId },
    });

    if (viewRows.length === 0) {
      throw new AppError('未找到最新的生豆库存数据。', { code: 'DATA' });
    }

    return mapSupabaseGreenBeanInventoryRecordToBean(viewRows[0]!);
  };

  const getEditableBeanDetail = async (beanId: string | number): Promise<GreenBeanEditableDetail> => {
    const beanRows = await client.list<SupabaseGreenBeanRecord>(tableName, {
      limit: 1,
      match: { id: beanId },
    });

    if (beanRows.length === 0) {
      throw new AppError('未找到生豆主档。', { code: 'DATA' });
    }

    const purchaseRows = await client.list<SupabasePurchaseBatchRecord>('green_bean_purchase_batches', {
      limit: 1,
      match: { green_bean_id: beanId },
      orderBy: {
        ascending: false,
        column: 'received_at',
      },
    });

    const saleSpecRows = await client.list<SupabaseSaleSpecRecord>('bean_sale_specs', {
      limit: 1,
      match: { green_bean_id: beanId, is_default: true },
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return mapSupabaseEditableBeanToFormInput(
      beanRows[0]!,
      purchaseRows[0] ?? null,
      saleSpecRows[0] ?? null,
    );
  };

  const upsertLatestPurchaseBatch = async (
    beanId: string | number,
    input: GreenBeanUpdateInput,
  ): Promise<void> => {
    const payload: EditablePurchaseBatchInput = {
      purchased_total_price: input.purchasedTotalPrice,
      purchased_weight_grams: input.purchasedWeightGrams,
      supplier_name: normalizeText(input.supplierName),
    };

    const latestBatchRows = await client.list<SupabasePurchaseBatchRecord>('green_bean_purchase_batches', {
      limit: 1,
      match: { green_bean_id: beanId },
      orderBy: {
        ascending: false,
        column: 'received_at',
      },
    });

    const latestBatch = latestBatchRows[0];

    if (!latestBatch) {
      await client.insert('green_bean_purchase_batches', {
        green_bean_id: beanId,
        purchased_total_price: payload.purchased_total_price,
        purchased_weight_grams: payload.purchased_weight_grams,
        received_at: new Date().toISOString().slice(0, 10),
        remaining_weight_grams: payload.purchased_weight_grams,
        supplier_name: payload.supplier_name ?? null,
      });
      return;
    }

    const nextRemainingWeight = Math.min(latestBatch.remaining_weight_grams, payload.purchased_weight_grams);

    await client.update('green_bean_purchase_batches', {
      ...payload,
      remaining_weight_grams: Math.max(nextRemainingWeight, 0),
    }, {
      match: { id: latestBatch.id },
      select: '*',
    });
  };

  const upsertDefaultSaleSpec = async (
    beanId: string | number,
    input: GreenBeanUpdateInput,
  ): Promise<void> => {
    if (input.defaultSaleUnitWeightGrams == null) {
      const existingSaleSpecs = await client.list<SupabaseSaleSpecRecord>('bean_sale_specs', {
        limit: 1,
        match: { green_bean_id: beanId, is_default: true },
      });

      if (existingSaleSpecs.length > 0) {
        await client.update('bean_sale_specs', {
          unit_price: input.defaultSaleUnitPrice,
        }, {
          match: { id: existingSaleSpecs[0]!.id },
          select: '*',
        });
        return;
      }

      return;
    }

    const existingSaleSpecs = await client.list<SupabaseSaleSpecRecord>('bean_sale_specs', {
      limit: 1,
      match: { green_bean_id: beanId, is_default: true },
    });

    if (existingSaleSpecs.length === 0) {
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
      match: { id: existingSaleSpecs[0]!.id },
      select: '*',
    });
  };

  return {
    async getBeanById(beanId) {
      const beans = await this.listBeans();

      return ok(beans.data.find((bean) => String(bean.id) === String(beanId)) ?? null);
    },
    async getEditableBean(beanId) {
      return ok(await getEditableBeanDetail(beanId));
    },
    async listBeans() {
      const rows = await client.list<SupabaseGreenBeanInventoryRecord>(viewName, {
        orderBy: {
          ascending: false,
          column: 'updated_at',
        },
      });

      const beans = rows.map((record) => mapSupabaseGreenBeanInventoryRecordToBean(record));

      beanCacheService.save(beans, 'supabase');

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

      if (!rows || rows.length === 0) {
        throw new AppError('更新失败：未找到记录。', { code: 'DATA' });
      }

      await upsertLatestPurchaseBatch(beanId, input);
      await upsertDefaultSaleSpec(beanId, input);

      const bean = await getLatestInventoryBean(beanId);

      beanCacheService.save([bean], 'supabase');

      return ok(bean);
    },
    async deleteBean(beanId) {
      // 按外键依赖顺序删除关联数据（避免 409 Conflict）
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
        code: input.code.trim(),
        default_roast_input_grams: input.defaultRoastInputGrams,
        display_name: input.displayName.trim(),
        harvest_season: normalizeText(input.harvestSeason),
        notes: normalizeText(input.notes),
        origin_area: normalizeText(input.originArea),
        origin_country: normalizeText(input.originCountry),
        origin_region: normalizeText(input.originRegion),
        process_method: input.processMethod.trim(),
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

      const insertedBeans = await client.insert(tableName, greenBeanPayload, { select: '*' });

      if (!insertedBeans || insertedBeans.length === 0) {
        throw new AppError('创建生豆失败：未返回数据。', { code: 'DATA' });
      }

      const newBeanId = (insertedBeans[0] as { id: string }).id;

      await upsertLatestPurchaseBatch(newBeanId, input);
      await upsertDefaultSaleSpec(newBeanId, input);

      const bean = await getLatestInventoryBean(newBeanId);

      beanCacheService.save([bean], 'supabase');

      return ok(bean);
    },
  };
}

const hasSupabaseConnection = (): boolean => {
  const connection = supabaseConnectionSettingsService.resolveProjectConnection('greenBean');

  if (!connection) {
    return false;
  }

  const { projectUrl, publishableKey } = connection;

  return projectUrl.trim().length > 0 && publishableKey.trim().length > 0;
};

export const resolveBeanRepository = (): BeanRepository => {
  if (import.meta.env.MODE === 'test') {
    logger.info('bean repository: mock (test mode)');
    return new MockBeanRepository();
  }

  if (!hasSupabaseConnection()) {
    logger.info('bean repository: mock (missing connection)');
    return new MockBeanRepository();
  }

  const connection = supabaseConnectionSettingsService.resolveProjectConnection('greenBean');
  const client = new SupabaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });

  logger.info('bean repository: supabase', {
    projectUrl: connection.projectUrl,
  });
  return createSupabaseGreenBeanInventoryRepository(client);
};

export const beanService = {
  async createBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>> {
    // 在线且已配置 Supabase：直接同步到 Supabase
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

    // 将本地记录转换为 Bean 类型返回
    const bean: Bean = {
      id: localRecord.id,
      name: localRecord.displayName,
      origin: [localRecord.originCountry, localRecord.originRegion, localRecord.originArea]
        .filter(Boolean)
        .join(' · '),
      process: localRecord.processMethod,
      grade: localRecord.variety,
      stockKg: parseFloat(((localRecord.purchasedWeightGrams ?? 0) / 1000).toFixed(1)),
      costPerKg:
        localRecord.purchasedWeightGrams > 0
          ? parseFloat((((localRecord.purchasedTotalPrice ?? 0) / localRecord.purchasedWeightGrams) * 1000).toFixed(2))
          : 0,
      supplierName: localRecord.supplierName ?? null,
      createdAt: localRecord.createdAt,
      updatedAt: localRecord.updatedAt,
      variety: localRecord.variety,
      harvestSeason: localRecord.harvestSeason ?? undefined,
      code: localRecord.code,
    };

    return ok(bean);
  },
  async getEditableBean(beanId: string | number): Promise<ApiResponse<GreenBeanEditableDetail>> {
    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      const localRecord = localGreenBeanService.listRecords().find((record) => record.id === beanId);

      if (!localRecord) {
        throw new AppError('未找到本地生豆记录。', { code: 'DATA' });
      }

      return ok({
        beanId: localRecord.id,
        code: localRecord.code,
        defaultRoastInputGrams: localRecord.defaultRoastInputGrams,
        defaultSaleUnitPrice: localRecord.defaultSaleUnitPrice,
        defaultSaleUnitWeightGrams: localRecord.defaultSaleUnitWeightGrams ?? null,
        displayName: localRecord.displayName,
        harvestSeason: localRecord.harvestSeason ?? '',
        millName: localRecord.millName ?? null,
        notes: localRecord.notes ?? null,
        originArea: localRecord.originArea ?? null,
        originCountry: localRecord.originCountry ?? '',
        originRegion: localRecord.originRegion ?? '',
        processMethod: localRecord.processMethod,
        purchasedTotalPrice: localRecord.purchasedTotalPrice,
        purchasedWeightGrams: localRecord.purchasedWeightGrams,
        supplierName: localRecord.supplierName ?? null,
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
  syncBeans(): Promise<ApiResponse<Bean[]>> {
    return this.listBeans();
  },
  async updateBean(beanId: string | number, input: GreenBeanUpdateInput): Promise<ApiResponse<Bean>> {
    // 在线且已配置 Supabase：直接同步到 Supabase
    if (beanSyncService.isOnline()) {
      try {
        return await resolveBeanRepository().updateBean(beanId, input);
      } catch (error) {
        logger.warn('bean update failed, fallback to pending queue', { error });
      }
    }

    // 离线或在线更新失败：记录 pending update
    beanSyncService.recordPendingUpdate(beanId, input as unknown as Record<string, unknown>);

    // 尝试从本地缓存更新（如果可能）
    throw new AppError('当前处于离线状态，更新已记录，将在联网后同步。', {
      code: 'NETWORK',
    });
  },
  async deleteBean(beanId: string | number): Promise<void> {
    // 在线且已配置 Supabase：直接同步到 Supabase
    if (beanSyncService.isOnline()) {
      try {
        await resolveBeanRepository().deleteBean(beanId);
        return;
      } catch (error) {
        logger.warn('bean delete failed, fallback to pending queue', { error });
      }
    }

    // 离线或在线删除失败：记录 pending delete
    // 如果是本地 ID（local- 开头），直接从本地存储中删除
    if (typeof beanId === 'string' && beanId.startsWith('local-')) {
      const allRecords = localGreenBeanService.listRecords();
      const filtered = allRecords.filter((r) => r.id !== beanId);
      const snapshot = { records: filtered, version: 1 as const };
      window.localStorage.setItem(
        'coffee-roasting-backstage:local-green-beans',
        JSON.stringify(snapshot),
      );
    } else {
      beanSyncService.recordPendingDelete(beanId);
    }
  },
  /**
   * 同步所有待处理操作到 Supabase
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
          const input = op.payload as unknown as GreenBeanCreateInput;
          try {
            await repo.createBean(input);
          } catch (createError) {
            // 409 Conflict = 该生豆已存在于 Supabase（可能之前已同步成功）
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
          await repo.updateBean(beanId as string | number, input as unknown as GreenBeanUpdateInput);
        } else if (op.type === 'delete') {
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
