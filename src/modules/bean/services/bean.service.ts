import { seedBeans } from '@/modules/bean/constants';
import { AppError } from '@/shared/errors/AppError';
import type { ApiResponse } from '@/services/api.types';
import type { Bean } from '@/types/domain';

export interface BeanRepository {
  getBeanById(beanId: number): Promise<ApiResponse<Bean | null>>;
  listBeans(): Promise<ApiResponse<Bean[]>>;
  syncBeans(): Promise<ApiResponse<Bean[]>>;
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

export class MockBeanRepository implements BeanRepository {
  private readonly beans: Bean[];

  constructor(beans: Bean[] = seedBeans) {
    this.beans = beans;
  }

  getBeanById(beanId: number): Promise<ApiResponse<Bean | null>> {
    return Promise.resolve(ok(this.beans.find((bean) => bean.id === beanId) ?? null));
  }

  listBeans(): Promise<ApiResponse<Bean[]>> {
    return Promise.resolve(ok(this.beans));
  }

  async syncBeans(): Promise<ApiResponse<Bean[]>> {
    return this.listBeans();
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
  };
}

export const beanRepository: BeanRepository = new MockBeanRepository();

export const beanService = {
  getBeanById(beanId: number): Promise<ApiResponse<Bean | null>> {
    return beanRepository.getBeanById(beanId);
  },
  listBeans(): Promise<ApiResponse<Bean[]>> {
    return beanRepository.listBeans();
  },
  syncBeans(): Promise<ApiResponse<Bean[]>> {
    return beanRepository.syncBeans();
  },
};
