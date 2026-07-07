import type { CostCalculationRecord } from '@/modules/finance/types';

interface LocalCostCalculationSnapshot {
  records: CostCalculationRecord[];
  version: 1;
}

const LOCAL_COST_CALCULATION_VERSION = 1;
export const localCostCalculationStorageKey = 'coffee-roasting-backstage:cost-calculations';
let currentCostCalculationSnapshot: LocalCostCalculationSnapshot | null = null;

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isCostCalculationRecord = (value: unknown): value is CostCalculationRecord => {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const record = value as Partial<CostCalculationRecord>;

  return (
    typeof record.id === 'string' &&
    typeof record.beanId === 'string' &&
    typeof record.beanName === 'string' &&
    typeof record.calculationName === 'string' &&
    typeof record.dataSource === 'string' &&
    isFiniteNumber(record.purchaseCostPerKg) &&
    isFiniteNumber(record.dehydrationRate) &&
    isFiniteNumber(record.roastInputWeightGrams) &&
    isFiniteNumber(record.packagingCost) &&
    isFiniteNumber(record.energyCost) &&
    isFiniteNumber(record.laborCost) &&
    isFiniteNumber(record.otherCost) &&
    isFiniteNumber(record.saleUnitWeightGrams) &&
    isFiniteNumber(record.saleUnitPrice) &&
    isFiniteNumber(record.targetProfitRate) &&
    isFiniteNumber(record.greenBeanCost) &&
    isFiniteNumber(record.roastedOutputWeightGrams) &&
    isFiniteNumber(record.totalBatchCost) &&
    isFiniteNumber(record.costPerRoastedKg) &&
    isFiniteNumber(record.costPerSaleUnit) &&
    isFiniteNumber(record.suggestedSalePrice) &&
    isFiniteNumber(record.profitPerSaleUnit) &&
    isFiniteNumber(record.profitRate) &&
    isFiniteNumber(record.saleUnitCount) &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
};

const isSnapshot = (value: unknown): value is LocalCostCalculationSnapshot => {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const snapshot = value as Partial<LocalCostCalculationSnapshot>;

  return (
    snapshot.version === LOCAL_COST_CALCULATION_VERSION &&
    Array.isArray(snapshot.records) &&
    snapshot.records.every(isCostCalculationRecord)
  );
};

const sortRecords = (records: CostCalculationRecord[]): CostCalculationRecord[] => {
  return [...records].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
};

const loadSnapshot = (): LocalCostCalculationSnapshot | null => {
  if (!currentCostCalculationSnapshot || !isSnapshot(currentCostCalculationSnapshot)) {
    return null;
  }

  return {
    ...currentCostCalculationSnapshot,
    records: sortRecords(currentCostCalculationSnapshot.records),
  };
};

const saveSnapshot = (snapshot: LocalCostCalculationSnapshot): void => {
  currentCostCalculationSnapshot = {
    ...snapshot,
    records: sortRecords(snapshot.records),
  };
};

const createLocalCalculationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const localCostCalculationService = {
  clear(): void {
    currentCostCalculationSnapshot = null;
  },
  createLocalId(): string {
    return createLocalCalculationId();
  },
  list(): CostCalculationRecord[] {
    return loadSnapshot()?.records ?? [];
  },
  replace(records: CostCalculationRecord[]): void {
    saveSnapshot({
      records: sortRecords(records),
      version: LOCAL_COST_CALCULATION_VERSION,
    });
  },
  upsert(record: CostCalculationRecord): void {
    const nextRecords = this.list().filter((current) => current.id !== record.id);

    saveSnapshot({
      records: sortRecords([record, ...nextRecords]),
      version: LOCAL_COST_CALCULATION_VERSION,
    });
  },
};
