import type { RoastBatchRecord } from '../../types/roastBatch';

const STORAGE_KEY = 'coffee-roasting-backstage:roast-batches';

export const pendingOptimisticCreateBatchIds = new Set<string>();

let localRoastBatches: RoastBatchRecord[] = [];

export const sortBatches = (batches: RoastBatchRecord[]): RoastBatchRecord[] => {
  return [...batches].sort((a, b) => {
    return new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime();
  });
};

const normalizeStoredBatch = (batch: RoastBatchRecord): RoastBatchRecord => ({
  ...batch,
  roastLevel: batch.roastLevel,
});

export const loadLocalBatches = (): RoastBatchRecord[] => {
  void STORAGE_KEY;
  return sortBatches(localRoastBatches.map(normalizeStoredBatch));
};

export const saveLocalBatches = (batches: RoastBatchRecord[]): void => {
  localRoastBatches = sortBatches(batches);
};

export const createOptimisticLocalBatchId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const isOptimisticLocalBatchId = (batchId: string): boolean => {
  return batchId.startsWith('local-');
};

export const getBatchSyncSnapshot = (batches: RoastBatchRecord[]): string => {
  return JSON.stringify(
    [...batches]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((batch) => `${batch.id}:${batch.updatedAt}`),
  );
};

export const saveBatchRecord = (record: RoastBatchRecord): void => {
  const batches = loadLocalBatches().filter((batch) => batch.id !== record.id);
  saveLocalBatches(sortBatches([record, ...batches]));
};

export const removeStoredBatch = (batchId: string): void => {
  saveLocalBatches(loadLocalBatches().filter((batch) => batch.id !== batchId));
};

export const restoreStoredBatch = (batch: RoastBatchRecord): void => {
  saveLocalBatches([batch, ...loadLocalBatches().filter((item) => item.id !== batch.id)]);
};
