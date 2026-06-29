import { supabaseConnectionSettingsService } from '@/modules/settings/services/supabaseConnectionSettings.service';
import { AppError } from '@/shared/errors/AppError';
import type { ApiResponse } from '@/services/api.types';
import { SupabaseRestClient } from '@/services/supabaseRestClient';
import { logger } from '@/shared/logger/logger';

import type {
  RoastBatchCreateInput,
  RoastBatchRecord,
  RoastBatchUpdateInput,
} from '../types/roastBatch';
import { roastedCoffeeBeanMirrorService } from './roastedCoffeeBeanMirror.service';

// ============ Repository 接口 ============

export interface RoastBatchRepository {
  createBatch(input: RoastBatchCreateInput): Promise<ApiResponse<RoastBatchRecord>>;
  deleteBatch(batchId: string): Promise<void>;
  listBatches(): Promise<ApiResponse<RoastBatchRecord[]>>;
  updateBatch(batchId: string, input: RoastBatchUpdateInput): Promise<ApiResponse<RoastBatchRecord>>;
}

// ============ 本地存储键 ============

const STORAGE_KEY = 'coffee-roasting-backstage:roast-batches';
const ROAST_BATCHES_SUPPORTS_ROASTED_BEAN_NAME = false;

const loadLocalBatches = (): RoastBatchRecord[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RoastBatchRecord[];
  } catch {
    return [];
  }
};

const saveLocalBatches = (batches: RoastBatchRecord[]): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
};

// ============ 工具函数 ============

const ok = <T,>(data: T): ApiResponse<T> => ({
  code: 0,
  data,
  message: 'ok',
});

const sortBatches = (batches: RoastBatchRecord[]): RoastBatchRecord[] => {
  return [...batches].sort((a, b) => {
    return new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime();
  });
};

const isMissingSupabaseResourceError = (error: unknown): boolean => {
  if (!(error instanceof AppError)) {
    return false;
  }

  const cause = error.cause;
  const payload = typeof cause === 'object' && cause != null ? (cause as { code?: string }) : null;

  return error.status === 404 || payload?.code?.startsWith('PGRST') === true;
};

const isMissingRoastedBeanNameColumnError = (error: unknown): boolean => {
  if (!(error instanceof AppError)) {
    return false;
  }

  const cause = error.cause;
  const payload = typeof cause === 'object' && cause != null ? (cause as { message?: string }) : null;
  const message = payload?.message ?? error.message;

  return message.includes("'roasted_bean_name'") && message.includes("'roast_batches'");
};

const mapUnknownSupabaseRecord = (record: unknown): RoastBatchRecord => {
  return mapSupabaseRoastBatchRecord(record as Record<string, unknown>);
};

const getLocalBatchAt = (batches: RoastBatchRecord[], index: number): RoastBatchRecord => {
  const batch = batches[index];

  if (!batch) {
    throw new AppError('未找到烘焙记录', { code: 'DATA' });
  }

  return batch;
};

// ============ Supabase 字段映射 ============

const toSupabaseRoastBatchPayload = (input: RoastBatchCreateInput | RoastBatchUpdateInput): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  if (input.roastDate !== undefined) payload.roast_date = input.roastDate;
  if (input.greenBeanId !== undefined) payload.green_bean_id = input.greenBeanId;
  if (ROAST_BATCHES_SUPPORTS_ROASTED_BEAN_NAME && input.roastedBeanName !== undefined) {
    payload.roasted_bean_name = input.roastedBeanName || null;
  }
  if (input.roastPlanId !== undefined) payload.roast_plan_id = input.roastPlanId || null;
  if (input.inputWeightGrams !== undefined) payload.input_weight_grams = input.inputWeightGrams;
  if (input.outputWeightGrams !== undefined) payload.output_weight_grams = input.outputWeightGrams;
  if (input.roastLevel !== undefined) payload.roast_level = input.roastLevel;
  if (input.developmentRatio !== undefined) payload.development_ratio = input.developmentRatio;
  if (input.firstCrackTime !== undefined) payload.first_crack_time = input.firstCrackTime;
  if (input.totalRoastTime !== undefined) payload.total_roast_time = input.totalRoastTime;
  if (input.notes !== undefined) payload.notes = input.notes || null;
  if (input.imageUrls !== undefined) payload.image_urls = input.imageUrls || [];
  if (input.status !== undefined) payload.status = input.status;

  return payload;
};

const omitRoastedBeanNamePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const nextPayload = { ...payload };

  delete nextPayload.roasted_bean_name;

  return nextPayload;
};

const mapSupabaseRoastBatchRecord = (record: Record<string, unknown>): RoastBatchRecord => ({
  id: record.id as string,
  roastDate: (record.roast_date as string) || '',
  greenBeanId: (record.green_bean_id as string) || '',
  greenBeanName: (record.green_bean_name as string) || '',
  roastedBeanName: (record.roasted_bean_name as string) || undefined,
  roastPlanId: (record.roast_plan_id as string) || undefined,
  roastPlanName: (record.roast_plan_name as string) || undefined,
  inputWeightGrams: (record.input_weight_grams as number) || 0,
  outputWeightGrams: (record.output_weight_grams as number) || 0,
  roastLevel: (record.roast_level as string) || '',
  developmentRatio: (record.development_ratio as number) || undefined,
  firstCrackTime: (record.first_crack_time as number) || undefined,
  totalRoastTime: (record.total_roast_time as number) || undefined,
  notes: (record.notes as string) || undefined,
  imageUrls: (record.image_urls as string[]) || [],
  status: (record.status as 'completed' | 'draft') || 'completed',
  createdAt: (record.created_at as string) || '',
  updatedAt: (record.updated_at as string) || '',
});

// ============ 连接检测 ============

const hasSupabaseConnection = (): boolean => {
  const connection = supabaseConnectionSettingsService.resolveProjectConnection('greenBean');
  if (!connection) return false;
  return connection.projectUrl.trim().length > 0 && connection.publishableKey.trim().length > 0;
};

const getSupabaseClient = (): SupabaseRestClient => {
  const connection = supabaseConnectionSettingsService.resolveProjectConnection('greenBean');
  return new SupabaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });
};

// ============ Mock Repository ============

class MockRoastBatchRepository implements RoastBatchRepository {
  async createBatch(input: RoastBatchCreateInput): Promise<ApiResponse<RoastBatchRecord>> {
    const batches = loadLocalBatches();
    const now = new Date().toISOString();
    const record: RoastBatchRecord = {
      ...input,
      roastedBeanName: input.roastedBeanName || input.greenBeanName,
      id: `local-${Date.now()}`,
      status: input.status || 'completed',
      imageUrls: input.imageUrls || [],
      createdAt: now,
      updatedAt: now,
    };
    saveLocalBatches(sortBatches([record, ...batches]));
    return ok(record);
  }

  async deleteBatch(batchId: string): Promise<void> {
    const batches = loadLocalBatches();
    saveLocalBatches(batches.filter((b) => b.id !== batchId));
  }

  async listBatches(): Promise<ApiResponse<RoastBatchRecord[]>> {
    return ok(sortBatches(loadLocalBatches()));
  }

  async updateBatch(batchId: string, input: RoastBatchUpdateInput): Promise<ApiResponse<RoastBatchRecord>> {
    const batches = loadLocalBatches();
    const index = batches.findIndex((b) => b.id === batchId);
    if (index === -1) {
      throw new AppError('未找到烘焙记录', { code: 'DATA' });
    }
    const currentBatch = getLocalBatchAt(batches, index);
    const updated: RoastBatchRecord = {
      ...currentBatch,
      ...input,
      roastedBeanName: input.roastedBeanName ?? currentBatch.roastedBeanName ?? currentBatch.greenBeanName,
      id: currentBatch.id,
      updatedAt: new Date().toISOString(),
    };
    batches[index] = updated;
    saveLocalBatches(batches);
    return ok(updated);
  }
}

// ============ Supabase Repository ============

class SupabaseRoastBatchRepository implements RoastBatchRepository {
  constructor(private readonly client: SupabaseRestClient) {}

  async createBatch(input: RoastBatchCreateInput): Promise<ApiResponse<RoastBatchRecord>> {
    const payload = toSupabaseRoastBatchPayload(input);
    let rows: Record<string, unknown>[];

    try {
      rows = await this.client.insert('roast_batches', payload, { select: '*' });
    } catch (error) {
      if (!isMissingRoastedBeanNameColumnError(error)) {
        throw error;
      }

      logger.warn('roast_batches missing roasted_bean_name column, retrying without it', {
        greenBeanId: input.greenBeanId,
      });
      rows = await this.client.insert('roast_batches', omitRoastedBeanNamePayload(payload), { select: '*' });
    }

    if (!rows || rows.length === 0) {
      throw new AppError('创建烘焙记录失败：未返回数据。', { code: 'DATA' });
    }
    return ok(mapUnknownSupabaseRecord(rows[0]));
  }

  async deleteBatch(batchId: string): Promise<void> {
    await this.client.delete('roast_batches', { match: { id: batchId } });
  }

  async listBatches(): Promise<ApiResponse<RoastBatchRecord[]>> {
    // 优先从视图查询（如有），否则查表；两者都缺失时安静降级为空列表。
    try {
      const rows = await this.client.list<any>('roast_batch_overview', {
        orderBy: { ascending: false, column: 'roast_date' },
      });
      return ok(rows.map(mapUnknownSupabaseRecord));
    } catch (overviewError) {
      if (!isMissingSupabaseResourceError(overviewError)) {
        throw overviewError;
      }

      try {
        const rows = await this.client.list<any>('roast_batches', {
          orderBy: { ascending: false, column: 'roast_date' },
        });
        return ok(rows.map(mapUnknownSupabaseRecord));
      } catch (tableError) {
        if (isMissingSupabaseResourceError(tableError)) {
          return ok([]);
        }

        throw tableError;
      }
    }
  }

  async updateBatch(batchId: string, input: RoastBatchUpdateInput): Promise<ApiResponse<RoastBatchRecord>> {
    const payload = toSupabaseRoastBatchPayload(input);
    let rows: Record<string, unknown>[];

    try {
      rows = await this.client.update('roast_batches', payload, {
        match: { id: batchId },
        select: '*',
      });
    } catch (error) {
      if (!isMissingRoastedBeanNameColumnError(error)) {
        throw error;
      }

      logger.warn('roast_batches missing roasted_bean_name column during update, retrying without it', {
        batchId,
      });
      rows = await this.client.update('roast_batches', omitRoastedBeanNamePayload(payload), {
        match: { id: batchId },
        select: '*',
      });
    }

    if (!rows || rows.length === 0) {
      throw new AppError('更新失败：未找到记录。', { code: 'DATA' });
    }
    return ok(mapUnknownSupabaseRecord(rows[0]));
  }
}

// ============ Repository 解析 ============

const resolveRoastBatchRepository = (): RoastBatchRepository => {
  if (!hasSupabaseConnection()) {
    return new MockRoastBatchRepository();
  }
  return new SupabaseRoastBatchRepository(getSupabaseClient());
};

// ============ Service ============

export const roastBatchService = {
  async createBatch(input: RoastBatchCreateInput): Promise<ApiResponse<RoastBatchRecord>> {
    const repository = resolveRoastBatchRepository();

    try {
      const createdResponse = await repository.createBatch(input);

      if (!roastedCoffeeBeanMirrorService.isEnabled()) {
        return createdResponse;
      }

      try {
        await roastedCoffeeBeanMirrorService.syncCreatedBatch(createdResponse.data);
      } catch (mirrorError) {
        try {
          await repository.deleteBatch(createdResponse.data.id);
        } catch (rollbackError) {
          logger.error('roast batch mirror rollback failed', {
            batchId: createdResponse.data.id,
            mirrorError,
            rollbackError,
          });

          throw new AppError('烘焙记录主库已创建，但熟豆库同步失败且自动回滚未完成，请立即检查两边数据。', {
            code: 'NETWORK',
            cause: {
              mirrorError,
              rollbackError,
            },
          });
        }

        throw mirrorError;
      }

      return createdResponse;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('创建烘焙记录失败。', { code: 'NETWORK', cause: error });
    }
  },

  async deleteBatch(batchId: string): Promise<void> {
    try {
      await resolveRoastBatchRepository().deleteBatch(batchId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('删除烘焙记录失败。', { code: 'NETWORK', cause: error });
    }
  },

  async listBatches(): Promise<ApiResponse<RoastBatchRecord[]>> {
    try {
      return await resolveRoastBatchRepository().listBatches();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('获取烘焙记录失败。', { code: 'NETWORK', cause: error });
    }
  },

  async updateBatch(batchId: string, input: RoastBatchUpdateInput): Promise<ApiResponse<RoastBatchRecord>> {
    try {
      return await resolveRoastBatchRepository().updateBatch(batchId, input);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('更新烘焙记录失败。', { code: 'NETWORK', cause: error });
    }
  },
};
