import { AppError } from '@/shared/errors/AppError';
import type { Bean } from '@/types/domain';

import type {
  GreenBeanCreateInput,
  GreenBeanUpdateInput,
  LocalGreenBeanRecord,
} from '../types/localGreenBean';

interface LocalGreenBeanSnapshot {
  records: LocalGreenBeanRecord[];
  version: 1;
}

const LOCAL_GREEN_BEAN_VERSION = 1;
export const localGreenBeanStorageKey = 'coffee-roasting-backstage:local-green-beans';
let currentLocalGreenBeanSnapshot: LocalGreenBeanSnapshot | null = null;

const normalizeText = (value: null | string | undefined): null | string => {
  const nextValue = value?.trim() ?? '';

  return nextValue.length > 0 ? nextValue : null;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isLocalGreenBeanRecord = (value: unknown): value is LocalGreenBeanRecord => {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const record = value as Partial<LocalGreenBeanRecord>;

  return (
    typeof record.id === 'string' &&
    record.source === 'local' &&
    (record.costTemplateId == null || typeof record.costTemplateId === 'string') &&
    typeof record.code === 'string' &&
    typeof record.displayName === 'string' &&
    typeof record.variety === 'string' &&
    typeof record.processMethod === 'string' &&
    isFiniteNumber(record.defaultRoastInputGrams) &&
    isFiniteNumber(record.purchasedWeightGrams) &&
    (record.remainingWeightGrams == null || isFiniteNumber(record.remainingWeightGrams)) &&
    isFiniteNumber(record.purchasedTotalPrice) &&
    isFiniteNumber(record.defaultSaleUnitPrice) &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
};

const normalizeRemainingWeightGrams = (
  purchasedWeightGrams: number,
  remainingWeightGrams: null | number | undefined,
): number => {
  if (!isFiniteNumber(remainingWeightGrams)) {
    return purchasedWeightGrams;
  }

  return Math.min(Math.max(Math.round(remainingWeightGrams), 0), purchasedWeightGrams);
};

const normalizeLocalGreenBeanRecord = (record: LocalGreenBeanRecord): LocalGreenBeanRecord => {
  return {
    ...record,
    costTemplateId: normalizeText(record.costTemplateId),
    grade: normalizeText(record.grade),
    remainingWeightGrams: normalizeRemainingWeightGrams(
      record.purchasedWeightGrams,
      record.remainingWeightGrams,
    ),
  };
};

const isLocalGreenBeanSnapshot = (value: unknown): value is LocalGreenBeanSnapshot => {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const snapshot = value as Partial<LocalGreenBeanSnapshot>;

  return (
    snapshot.version === LOCAL_GREEN_BEAN_VERSION &&
    Array.isArray(snapshot.records) &&
    snapshot.records.every(isLocalGreenBeanRecord)
  );
};

const loadSnapshot = (): LocalGreenBeanSnapshot | null => {
  if (!currentLocalGreenBeanSnapshot || !isLocalGreenBeanSnapshot(currentLocalGreenBeanSnapshot)) {
    return null;
  }

  return {
    ...currentLocalGreenBeanSnapshot,
    records: currentLocalGreenBeanSnapshot.records.map(normalizeLocalGreenBeanRecord),
  };
};

const saveSnapshot = (snapshot: LocalGreenBeanSnapshot): void => {
  currentLocalGreenBeanSnapshot = snapshot;
};

const saveRecords = (records: LocalGreenBeanRecord[]): void => {
  saveSnapshot({
    records,
    version: LOCAL_GREEN_BEAN_VERSION,
  });
};

const createLocalBeanId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const buildOriginLabel = (record: GreenBeanCreateInput): string => {
  return [record.originCountry, record.originRegion, normalizeText(record.originArea)].filter(Boolean).join(' · ');
};

const calculateCostPerKg = (record: GreenBeanCreateInput): number => {
  if (record.purchasedWeightGrams <= 0) {
    return 0;
  }

  return Number(((record.purchasedTotalPrice / record.purchasedWeightGrams) * 1000).toFixed(2));
};

const calculateStockKg = (record: GreenBeanCreateInput): number => {
  return Number((normalizeRemainingWeightGrams(record.purchasedWeightGrams, record.remainingWeightGrams) / 1000).toFixed(1));
};

export const mapLocalGreenBeanRecordToBean = (record: LocalGreenBeanRecord): Bean => ({
  id: record.id,
  altitudeMetersMax: record.altitudeMetersMax ?? null,
  altitudeMetersMin: record.altitudeMetersMin ?? null,
  name: record.displayName,
  code: record.code,
  defaultRoastInputGrams: record.defaultRoastInputGrams,
  defaultSaleUnitPrice: record.defaultSaleUnitPrice,
  defaultSaleUnitWeightGrams: record.defaultSaleUnitWeightGrams ?? null,
  costTemplateId: normalizeText(record.costTemplateId),
  densityGPerL: record.densityGPerL ?? null,
  harvestSeason: normalizeText(record.harvestSeason) ?? undefined,
  millName: record.millName ?? null,
  moisturePercent: record.moisturePercent ?? null,
  notes: record.notes ?? null,
  origin: buildOriginLabel(record),
  originArea: record.originArea ?? null,
  originCountry: record.originCountry ?? null,
  originRegion: record.originRegion ?? null,
  process: record.processMethod,
  grade: normalizeText(record.grade) ?? '',
  purchasedTotalPrice: record.purchasedTotalPrice,
  purchasedWeightGrams: record.purchasedWeightGrams,
  remainingWeightGrams: record.remainingWeightGrams,
  stockKg: calculateStockKg(record),
  costPerKg: calculateCostPerKg(record),
  supplierName: normalizeText(record.supplierName),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  variety: record.variety,
});

export const localGreenBeanService = {
  clear(): void {
    currentLocalGreenBeanSnapshot = null;
  },
  create(input: GreenBeanCreateInput): LocalGreenBeanRecord {
    const currentRecords = this.listRecords();
    const timestamp = new Date().toISOString();
    const nextRecord: LocalGreenBeanRecord = {
      ...input,
      code: input.code.trim(),
      costTemplateId: normalizeText(input.costTemplateId),
      defaultSaleUnitWeightGrams: input.defaultSaleUnitWeightGrams ?? null,
      displayName: input.displayName.trim(),
      grade: normalizeText(input.grade),
      harvestSeason: normalizeText(input.harvestSeason),
      millName: normalizeText(input.millName),
      notes: normalizeText(input.notes),
      originArea: normalizeText(input.originArea),
      originCountry: normalizeText(input.originCountry),
      originRegion: normalizeText(input.originRegion),
      processMethod: input.processMethod.trim(),
      remainingWeightGrams: normalizeRemainingWeightGrams(
        input.purchasedWeightGrams,
        input.remainingWeightGrams,
      ),
      supplierName: normalizeText(input.supplierName),
      variety: input.variety.trim(),
      createdAt: timestamp,
      id: createLocalBeanId(),
      source: 'local',
      updatedAt: timestamp,
    };

    saveRecords([nextRecord, ...currentRecords]);

    return nextRecord;
  },
  adjustRemainingWeight(beanId: string, deltaGrams: number): LocalGreenBeanRecord {
    const records = this.listRecords();
    const index = records.findIndex((record) => record.id === beanId);

    if (index === -1) {
      throw new AppError('未找到本地生豆记录。', { code: 'DATA' });
    }

    const currentRecord = records[index];

    if (!currentRecord) {
      throw new AppError('未找到本地生豆记录。', { code: 'DATA' });
    }
    const currentRemainingWeight = normalizeRemainingWeightGrams(
      currentRecord.purchasedWeightGrams,
      currentRecord.remainingWeightGrams,
    );
    const nextRemainingWeight = currentRemainingWeight - deltaGrams;

    if (nextRemainingWeight < 0) {
      throw new AppError('剩余库存不足，无法记录本次烘焙。', { code: 'DATA' });
    }

    const updatedRecord = normalizeLocalGreenBeanRecord({
      ...currentRecord,
      remainingWeightGrams: Math.min(nextRemainingWeight, currentRecord.purchasedWeightGrams),
      updatedAt: new Date().toISOString(),
    });

    const nextRecords = [...records];
    nextRecords[index] = updatedRecord;
    saveRecords(nextRecords);

    return updatedRecord;
  },
  findRecordById(beanId: string): LocalGreenBeanRecord | null {
    return this.listRecords().find((record) => record.id === beanId) ?? null;
  },
  listBeans(): Bean[] {
    return this.listRecords().map(mapLocalGreenBeanRecordToBean);
  },
  listRecords(): LocalGreenBeanRecord[] {
    return loadSnapshot()?.records ?? [];
  },
  /**
   * 按 code 删除本地记录（用于远端同步成功后清除重复的本地副本）
   */
  removeByCode(code: string): boolean {
    const allRecords = this.listRecords();
    const filtered = allRecords.filter((r) => r.code !== code);

    if (filtered.length === allRecords.length) {
      return false;
    }

    saveRecords(filtered);

    return true;
  },
  removeById(beanId: string): boolean {
    const allRecords = this.listRecords();
    const filtered = allRecords.filter((record) => record.id !== beanId);

    if (filtered.length === allRecords.length) {
      return false;
    }

    saveRecords(filtered);

    return true;
  },
  restore(record: LocalGreenBeanRecord): LocalGreenBeanRecord {
    const allRecords = this.listRecords();
    const nextRecord = normalizeLocalGreenBeanRecord(record);
    const filtered = allRecords.filter((existing) => existing.id !== nextRecord.id);

    saveRecords([nextRecord, ...filtered]);

    return nextRecord;
  },
  update(beanId: string, input: GreenBeanUpdateInput): LocalGreenBeanRecord {
    const records = this.listRecords();
    const index = records.findIndex((record) => record.id === beanId);

    if (index === -1) {
      throw new AppError('未找到本地生豆记录。', { code: 'DATA' });
    }

    const currentRecord = records[index];

    if (!currentRecord) {
      throw new AppError('未找到本地生豆记录。', { code: 'DATA' });
    }
    const updatedRecord = normalizeLocalGreenBeanRecord({
      ...currentRecord,
      ...input,
      code: input.code.trim(),
      costTemplateId: normalizeText(input.costTemplateId),
      displayName: input.displayName.trim(),
      grade: normalizeText(input.grade),
      harvestSeason: normalizeText(input.harvestSeason),
      millName: normalizeText(input.millName),
      notes: normalizeText(input.notes),
      originArea: normalizeText(input.originArea),
      originCountry: normalizeText(input.originCountry),
      originRegion: normalizeText(input.originRegion),
      processMethod: input.processMethod.trim(),
      supplierName: normalizeText(input.supplierName),
      variety: input.variety.trim(),
      updatedAt: new Date().toISOString(),
    });

    const nextRecords = [...records];
    nextRecords[index] = updatedRecord;
    saveRecords(nextRecords);

    return updatedRecord;
  },
};
