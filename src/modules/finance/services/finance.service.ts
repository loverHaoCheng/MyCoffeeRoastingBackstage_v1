import { supabaseConnectionSettingsService } from '@/modules/settings/services/supabaseConnectionSettings.service';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';
import type { ApiResponse } from '@/services/api.types';
import { SupabaseRestClient } from '@/services/supabaseRestClient';

import type {
  CostCalculationFormInput,
  CostCalculationMetrics,
  CostCalculationRecord,
  FinanceDataSource,
} from '../types';
import { localCostCalculationService } from './localCostCalculation.service';

interface FinanceRepository {
  listCalculations(): Promise<ApiResponse<CostCalculationRecord[]>>;
  saveCalculation(input: CostCalculationFormInput): Promise<ApiResponse<CostCalculationRecord>>;
}

interface SupabaseCostCalculationRecord {
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

const mapFormInputToLocalRecord = (
  input: CostCalculationFormInput,
  dataSource: FinanceDataSource,
): CostCalculationRecord => {
  const metrics = calculateCostMetrics(input);
  const timestamp = new Date().toISOString();
  const resolvedSaleUnitPrice = input.saleUnitPrice > 0 ? input.saleUnitPrice : metrics.suggestedSalePrice;

  return {
    ...input,
    ...metrics,
    calculationName: input.calculationName.trim(),
    createdAt: timestamp,
    dataSource,
    id: localCostCalculationService.createLocalId(),
    notes: normalizeText(input.notes),
    saleUnitPrice: resolvedSaleUnitPrice,
    updatedAt: timestamp,
  };
};

const mapCostCalculationRecordToFormInput = (record: CostCalculationRecord): CostCalculationFormInput => ({
  beanId: record.beanId,
  beanName: record.beanName,
  calculationName: record.calculationName,
  dehydrationRate: record.dehydrationRate,
  energyCost: record.energyCost,
  laborCost: record.laborCost,
  notes: record.notes,
  otherCost: record.otherCost,
  packagingCost: record.packagingCost,
  purchaseCostPerKg: record.purchaseCostPerKg,
  roastInputWeightGrams: record.roastInputWeightGrams,
  saleUnitPrice: record.saleUnitPrice,
  saleUnitWeightGrams: record.saleUnitWeightGrams,
  targetProfitRate: record.targetProfitRate,
});

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

const mapSupabaseRecordToCostCalculation = (record: SupabaseCostCalculationRecord): CostCalculationRecord => ({
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

const resolveFinanceConnection = ():
  | {
      client: SupabaseRestClient;
      dataSource: FinanceDataSource;
    }
  | null => {
  const roastedConnection = supabaseConnectionSettingsService.resolveProjectConnection('roastedBean');

  if (roastedConnection.projectUrl.trim() && roastedConnection.publishableKey.trim()) {
    return {
      client: new SupabaseRestClient(roastedConnection),
      dataSource: 'roastedBean',
    };
  }

  const greenConnection = supabaseConnectionSettingsService.resolveProjectConnection('greenBean');

  if (greenConnection.projectUrl.trim() && greenConnection.publishableKey.trim()) {
    return {
      client: new SupabaseRestClient(greenConnection),
      dataSource: 'greenBean',
    };
  }

  return null;
};

const createSupabaseFinanceRepository = (
  client: SupabaseRestClient,
  dataSource: FinanceDataSource,
): FinanceRepository => ({
  async listCalculations() {
    const rows = await client.list<SupabaseCostCalculationRecord>(COST_CALCULATIONS_TABLE, {
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return ok(rows.map(mapSupabaseRecordToCostCalculation));
  },
  async saveCalculation(input) {
    const metrics = calculateCostMetrics(input);
    const resolvedSaleUnitPrice = metrics.suggestedSalePrice;
    const rows = await client.insert<SupabaseCostCalculationRecord>(
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

    return ok(mapSupabaseRecordToCostCalculation(savedRow));
  },
});

export const financeService = {
  getBootstrappedCalculations(): CostCalculationRecord[] {
    return localCostCalculationService.list();
  },
  getResolvedDataSource(): FinanceDataSource | null {
    return resolveFinanceConnection()?.dataSource ?? null;
  },
  async listCalculations(): Promise<ApiResponse<CostCalculationRecord[]>> {
    const cachedRecords = localCostCalculationService.list();
    const resolved = resolveFinanceConnection();

    if (!resolved) {
      return ok(cachedRecords);
    }

    try {
      const response = await createSupabaseFinanceRepository(resolved.client, resolved.dataSource).listCalculations();
      localCostCalculationService.replace(response.data);
      return response;
    } catch (error) {
      if (cachedRecords.length > 0) {
        logger.warn('finance list failed, falling back to local cache', { error });
        return ok(cachedRecords);
      }

      throw error;
    }
  },
  async saveCalculation(input: CostCalculationFormInput): Promise<ApiResponse<CostCalculationRecord>> {
    const resolved = resolveFinanceConnection();

    if (resolved && (typeof navigator === 'undefined' || navigator.onLine)) {
      try {
        const response = await createSupabaseFinanceRepository(resolved.client, resolved.dataSource).saveCalculation(input);
        localCostCalculationService.upsert(response.data);
        return response;
      } catch (error) {
        logger.warn('finance save failed, falling back to local cache', { error });
      }
    }

    const localRecord = mapFormInputToLocalRecord(input, resolved?.dataSource ?? 'greenBean');
    localCostCalculationService.upsert(localRecord);

    return ok(localRecord);
  },
  async syncLocalAndRemote(): Promise<{ downloaded: number; uploaded: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { downloaded: 0, uploaded: 0 };
    }

    const resolved = resolveFinanceConnection();

    if (!resolved) {
      return { downloaded: 0, uploaded: 0 };
    }

    const repository = createSupabaseFinanceRepository(resolved.client, resolved.dataSource);
    const localRecordsBeforeSync = localCostCalculationService.list();
    const remoteBeforeSync = await repository.listCalculations();
    const remoteIds = new Set(remoteBeforeSync.data.map((record) => record.id));
    let uploaded = 0;

    for (const record of localRecordsBeforeSync) {
      if (remoteIds.has(record.id)) {
        continue;
      }

      await repository.saveCalculation(mapCostCalculationRecordToFormInput(record));
      uploaded += 1;
    }

    const remoteAfterSync = await repository.listCalculations();
    const nextRecords = remoteAfterSync.data;
    const beforeSignature = getCalculationSyncSnapshot(localRecordsBeforeSync);
    const afterSignature = getCalculationSyncSnapshot(nextRecords);

    localCostCalculationService.replace(nextRecords);

    return {
      downloaded: beforeSignature === afterSignature ? 0 : nextRecords.length,
      uploaded,
    };
  },
};
