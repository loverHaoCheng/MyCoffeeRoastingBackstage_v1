import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';
import type { ApiResponse } from '@/services/api.types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

import type {
  CostCalculationFormInput,
  CostCalculationMetrics,
  CostCalculationRecord,
  FinanceDataSource,
} from '../types';

interface FinanceRepository {
  listCalculations(): Promise<ApiResponse<CostCalculationRecord[]>>;
  saveCalculation(input: CostCalculationFormInput): Promise<ApiResponse<CostCalculationRecord>>;
}

interface FinanceConnectionCandidate {
  client: Pick<PocketBaseRestClient, 'insert' | 'list'>;
  dataSource: FinanceDataSource;
}

interface RemoteCostCalculationRecord {
  bean_id: string;
  bean_name: string;
  calculation_name: string;
  cost_per_roasted_kg: number;
  cost_per_sale_unit: number;
  created_at: string;
  data_source: FinanceDataSource;
  dehydration_rate: number;
  energy_cost: number;
  id: string;
  labor_cost: number;
  notes: null | string;
  other_cost: number;
  packaging_cost: number;
  profit_per_sale_unit: number;
  profit_rate: number;
  purchase_cost_per_kg: number;
  roast_input_weight_grams: number;
  roasted_output_weight_grams: number;
  sale_unit_count: number;
  sale_unit_price: number;
  sale_unit_weight_grams: number;
  suggested_sale_price: number;
  target_profit_rate: number;
  total_batch_cost: number;
  updated_at: string;
}

const COST_CALCULATIONS_TABLE = 'cost_calculations';
let currentCostCalculationRecords: CostCalculationRecord[] = [];

const ok = <T,>(data: T): ApiResponse<T> => ({
  code: 0,
  data,
  message: 'ok',
});

const normalizeText = (value: null | string | undefined): null | string => {
  const nextValue = value?.trim() ?? '';

  return nextValue.length > 0 ? nextValue : null;
};

const getCalculationSyncSnapshot = (records: CostCalculationRecord[]): string => {
  return JSON.stringify(
    [...records]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((record) => `${record.id}:${record.updatedAt}`),
  );
};

export const calculateCostMetrics = (input: CostCalculationFormInput): CostCalculationMetrics => {
  const safeSaleUnitWeightGrams = input.saleUnitWeightGrams > 0 ? input.saleUnitWeightGrams : 1;
  const roastedOutputWeightGrams = Number(
    (input.roastInputWeightGrams * (1 - input.dehydrationRate / 100)).toFixed(1),
  );
  const greenBeanCost = Number(((input.purchaseCostPerKg / 1000) * input.roastInputWeightGrams).toFixed(2));
  const totalBatchCost = Number(
    (greenBeanCost + input.packagingCost + input.energyCost + input.laborCost + input.otherCost).toFixed(2),
  );
  const safeRoastedOutputWeightGrams = roastedOutputWeightGrams > 0 ? roastedOutputWeightGrams : 1;
  const saleUnitCount = Number((safeRoastedOutputWeightGrams / safeSaleUnitWeightGrams).toFixed(2));
  const costPerSaleUnit = Number(((totalBatchCost / safeRoastedOutputWeightGrams) * safeSaleUnitWeightGrams).toFixed(2));
  const suggestedSalePrice = Number((costPerSaleUnit * (1 + input.targetProfitRate / 100)).toFixed(2));
  const effectiveSaleUnitPrice = input.saleUnitPrice > 0 ? input.saleUnitPrice : suggestedSalePrice;
  const profitPerSaleUnit = Number((effectiveSaleUnitPrice - costPerSaleUnit).toFixed(2));
  const profitRate =
    effectiveSaleUnitPrice > 0 ? Number(((profitPerSaleUnit / effectiveSaleUnitPrice) * 100).toFixed(1)) : 0;

  return {
    greenBeanCost,
    roastedOutputWeightGrams,
    totalBatchCost,
    costPerRoastedKg: Number(((totalBatchCost / safeRoastedOutputWeightGrams) * 1000).toFixed(2)),
    costPerSaleUnit,
    suggestedSalePrice,
    profitPerSaleUnit,
    profitRate,
    saleUnitCount,
  };
};

const mapRemoteRecordToCostCalculation = (record: RemoteCostCalculationRecord): CostCalculationRecord => ({
  beanId: record.bean_id,
  beanName: record.bean_name,
  calculationName: record.calculation_name,
  costPerRoastedKg: record.cost_per_roasted_kg,
  costPerSaleUnit: record.cost_per_sale_unit,
  createdAt: record.created_at,
  dataSource: record.data_source,
  dehydrationRate: record.dehydration_rate,
  energyCost: record.energy_cost,
  id: record.id,
  laborCost: record.labor_cost,
  notes: record.notes,
  otherCost: record.other_cost,
  packagingCost: record.packaging_cost,
  profitPerSaleUnit: record.profit_per_sale_unit,
  profitRate: record.profit_rate,
  greenBeanCost: Number(((record.purchase_cost_per_kg / 1000) * record.roast_input_weight_grams).toFixed(2)),
  purchaseCostPerKg: record.purchase_cost_per_kg,
  roastInputWeightGrams: record.roast_input_weight_grams,
  roastedOutputWeightGrams: record.roasted_output_weight_grams,
  saleUnitCount: record.sale_unit_count,
  saleUnitPrice: record.sale_unit_price,
  saleUnitWeightGrams: record.sale_unit_weight_grams,
  suggestedSalePrice: record.suggested_sale_price,
  targetProfitRate: record.target_profit_rate,
  totalBatchCost: record.total_batch_cost,
  updatedAt: record.updated_at,
});

const setCurrentCostCalculationRecords = (records: CostCalculationRecord[]): CostCalculationRecord[] => {
  currentCostCalculationRecords = [...records].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

  return currentCostCalculationRecords;
};

const resolveFinanceConnection = ():
  | FinanceConnectionCandidate
  | null => {
  return resolveFinanceConnectionCandidates()[0] ?? null;
};

const resolveFinanceConnectionCandidates = (): FinanceConnectionCandidate[] => {
  return [{
    client: new PocketBaseRestClient({
      projectUrl: '',
      publishableKey: '',
    }),
    dataSource: 'greenBean',
  }];
};

const isMissingRemoteResourceError = (error: unknown): boolean => {
  if (!(error instanceof AppError)) {
    return false;
  }

  const cause = error.cause;
  const payload = typeof cause === 'object' && cause != null ? (cause as { code?: string; message?: string }) : null;
  const message = payload?.message ?? error.message;

  return error.status === 404 || payload?.code?.startsWith('PGRST') === true || message.includes('不存在');
};

const createRemoteFinanceRepository = (
  client: Pick<PocketBaseRestClient, 'insert' | 'list'>,
  dataSource: FinanceDataSource,
): FinanceRepository => ({
  async listCalculations() {
    const rows = await client.list<RemoteCostCalculationRecord>(COST_CALCULATIONS_TABLE, {
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return ok(rows.map(mapRemoteRecordToCostCalculation));
  },
  async saveCalculation(input) {
    const metrics = calculateCostMetrics(input);
    const resolvedSaleUnitPrice = metrics.suggestedSalePrice;
    const rows = await client.insert<RemoteCostCalculationRecord>(
      COST_CALCULATIONS_TABLE,
      {
        bean_id: input.beanId,
        bean_name: input.beanName,
        calculation_name: input.calculationName.trim(),
        cost_per_roasted_kg: metrics.costPerRoastedKg,
        cost_per_sale_unit: metrics.costPerSaleUnit,
        data_source: dataSource,
        dehydration_rate: input.dehydrationRate,
        energy_cost: input.energyCost,
        labor_cost: input.laborCost,
        notes: normalizeText(input.notes),
        other_cost: input.otherCost,
        packaging_cost: input.packagingCost,
        profit_per_sale_unit: metrics.profitPerSaleUnit,
        profit_rate: metrics.profitRate,
        purchase_cost_per_kg: input.purchaseCostPerKg,
        roast_input_weight_grams: input.roastInputWeightGrams,
        roasted_output_weight_grams: metrics.roastedOutputWeightGrams,
        sale_unit_count: metrics.saleUnitCount,
        sale_unit_price: resolvedSaleUnitPrice,
        sale_unit_weight_grams: input.saleUnitWeightGrams,
        suggested_sale_price: metrics.suggestedSalePrice,
        target_profit_rate: input.targetProfitRate,
        total_batch_cost: metrics.totalBatchCost,
      },
      { select: '*' },
    );

    if (rows.length === 0) {
      throw new AppError('成本核算保存失败：未返回数据。', { code: 'DATA' });
    }

    const savedRow = rows[0];

    if (!savedRow) {
      throw new AppError('成本核算保存失败：结果缺失。', { code: 'DATA' });
    }

    return ok(mapRemoteRecordToCostCalculation(savedRow));
  },
});

export const financeService = {
  clear(): void {
    currentCostCalculationRecords = [];
  },
  getBootstrappedCalculations(): CostCalculationRecord[] {
    return currentCostCalculationRecords;
  },
  getResolvedDataSource(): FinanceDataSource | null {
    return resolveFinanceConnection()?.dataSource ?? null;
  },
  async listCalculations(): Promise<ApiResponse<CostCalculationRecord[]>> {
    const candidates = resolveFinanceConnectionCandidates();

    if (candidates.length === 0) {
      throw new AppError('PocketBase 连接配置缺失。', { code: 'CONFIG' });
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const response = await createRemoteFinanceRepository(candidate.client, candidate.dataSource).listCalculations();
        setCurrentCostCalculationRecords(response.data);
        return response;
      } catch (error) {
        lastError = error;

        if (!isMissingRemoteResourceError(error)) {
          break;
        }

        logger.warn('finance list missing remote table, trying fallback source', {
          dataSource: candidate.dataSource,
          error,
        });
      }
    }

    throw lastError;
  },
  async saveCalculation(input: CostCalculationFormInput): Promise<ApiResponse<CostCalculationRecord>> {
    const candidates = resolveFinanceConnectionCandidates();

    if (candidates.length === 0) {
      throw new AppError('PocketBase 连接配置缺失。', { code: 'CONFIG' });
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new AppError('当前网络不可用，无法保存成本核算。', { code: 'NETWORK' });
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const response = await createRemoteFinanceRepository(candidate.client, candidate.dataSource).saveCalculation(input);
        setCurrentCostCalculationRecords([
          response.data,
          ...currentCostCalculationRecords.filter((record) => record.id !== response.data.id),
        ]);
        return response;
      } catch (error) {
        lastError = error;

        if (!isMissingRemoteResourceError(error)) {
          break;
        }

        logger.warn('finance save missing remote table, trying fallback source', {
          dataSource: candidate.dataSource,
          error,
        });
      }
    }

    throw lastError;
  },
  async syncLocalAndRemote(): Promise<{ downloaded: number; uploaded: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { downloaded: 0, uploaded: 0 };
    }

    const candidates = resolveFinanceConnectionCandidates();

    if (candidates.length === 0) {
      return { downloaded: 0, uploaded: 0 };
    }

    const localRecordsBeforeSync = currentCostCalculationRecords;
    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const repository = createRemoteFinanceRepository(candidate.client, candidate.dataSource);
        const remoteAfterSync = await repository.listCalculations();
        const nextRecords = remoteAfterSync.data;
        const beforeSignature = getCalculationSyncSnapshot(localRecordsBeforeSync);
        const afterSignature = getCalculationSyncSnapshot(nextRecords);

        setCurrentCostCalculationRecords(nextRecords);

        return {
          downloaded: beforeSignature === afterSignature ? 0 : nextRecords.length,
          uploaded: 0,
        };
      } catch (error) {
        lastError = error;

        if (!isMissingRemoteResourceError(error)) {
          break;
        }

        logger.warn('finance sync missing remote table, trying fallback source', {
          dataSource: candidate.dataSource,
          error,
        });
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new AppError('成本核算同步失败。', { code: 'NETWORK', cause: lastError });
  },
};
