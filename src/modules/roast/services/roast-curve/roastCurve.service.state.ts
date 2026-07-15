import type { RoastCurveRecord } from '../../types/roastCurve';

let localCurveRecords: RoastCurveRecord[] = [];

export const createLocalCurveId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-curve-${crypto.randomUUID()}`;
  }

  return `local-curve-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const loadLocalCurveByBatchId = (roastBatchId: string): RoastCurveRecord | null => {
  return localCurveRecords.find((record) => record.roastBatchId === roastBatchId) ?? null;
};

export const saveLocalCurveRecord = (record: RoastCurveRecord): RoastCurveRecord => {
  localCurveRecords = [
    record,
    ...localCurveRecords.filter((item) => item.roastBatchId !== record.roastBatchId),
  ];

  return record;
};

export const removeLocalCurveByBatchId = (roastBatchId: string): void => {
  localCurveRecords = localCurveRecords.filter((record) => record.roastBatchId !== roastBatchId);
};

export const clearRoastCurveState = (): void => {
  localCurveRecords = [];
};
