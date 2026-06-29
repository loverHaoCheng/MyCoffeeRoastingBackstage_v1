import type { Bean } from '@/types/domain';

import type { GreenBeanCreateInput, LocalGreenBeanRecord } from '../types/localGreenBean';

interface LocalGreenBeanSnapshot {
  records: LocalGreenBeanRecord[];
  version: 1;
}

const LOCAL_GREEN_BEAN_VERSION = 1;
export const localGreenBeanStorageKey = 'coffee-roasting-backstage:local-green-beans';

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

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
    typeof record.code === 'string' &&
    typeof record.displayName === 'string' &&
    typeof record.variety === 'string' &&
    typeof record.processMethod === 'string' &&
    isFiniteNumber(record.defaultRoastInputGrams) &&
    isFiniteNumber(record.purchasedWeightGrams) &&
    isFiniteNumber(record.purchasedTotalPrice) &&
    isFiniteNumber(record.defaultSaleUnitPrice) &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
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
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(localGreenBeanStorageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isLocalGreenBeanSnapshot(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const saveSnapshot = (snapshot: LocalGreenBeanSnapshot): void => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(localGreenBeanStorageKey, JSON.stringify(snapshot));
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
  return Number((record.purchasedWeightGrams / 1000).toFixed(1));
};

export const mapLocalGreenBeanRecordToBean = (record: LocalGreenBeanRecord): Bean => ({
  id: record.id,
  name: record.displayName,
  origin: buildOriginLabel(record),
  process: record.processMethod,
  grade: record.variety,
  stockKg: calculateStockKg(record),
  costPerKg: calculateCostPerKg(record),
  supplierName: normalizeText(record.supplierName),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  code: record.code,
  defaultRoastInputGrams: record.defaultRoastInputGrams,
  defaultSaleUnitPrice: record.defaultSaleUnitPrice,
  defaultSaleUnitWeightGrams: record.defaultSaleUnitWeightGrams ?? null,
  harvestSeason: normalizeText(record.harvestSeason) ?? undefined,
  variety: record.variety,
});

export const localGreenBeanService = {
  clear(): void {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(localGreenBeanStorageKey);
  },
  create(input: GreenBeanCreateInput): LocalGreenBeanRecord {
    const currentRecords = this.listRecords();
    const timestamp = new Date().toISOString();
    const nextRecord: LocalGreenBeanRecord = {
      ...input,
      code: input.code.trim(),
      defaultSaleUnitWeightGrams: input.defaultSaleUnitWeightGrams ?? null,
      displayName: input.displayName.trim(),
      harvestSeason: normalizeText(input.harvestSeason),
      millName: normalizeText(input.millName),
      notes: normalizeText(input.notes),
      originArea: normalizeText(input.originArea),
      originCountry: normalizeText(input.originCountry),
      originRegion: normalizeText(input.originRegion),
      processMethod: input.processMethod.trim(),
      supplierName: normalizeText(input.supplierName),
      variety: input.variety.trim(),
      createdAt: timestamp,
      id: createLocalBeanId(),
      source: 'local',
      updatedAt: timestamp,
    };

    saveSnapshot({
      records: [nextRecord, ...currentRecords],
      version: LOCAL_GREEN_BEAN_VERSION,
    });

    return nextRecord;
  },
  listBeans(): Bean[] {
    return this.listRecords().map(mapLocalGreenBeanRecordToBean);
  },
  listRecords(): LocalGreenBeanRecord[] {
    return loadSnapshot()?.records ?? [];
  },
  /**
   * 按 code 删除本地记录（用于 Supabase 同步成功后清除重复的本地副本）
   */
  removeByCode(code: string): boolean {
    const allRecords = this.listRecords();
    const filtered = allRecords.filter((r) => r.code !== code);

    if (filtered.length === allRecords.length) {
      return false;
    }

    saveSnapshot({ records: filtered, version: LOCAL_GREEN_BEAN_VERSION });

    return true;
  },
};
