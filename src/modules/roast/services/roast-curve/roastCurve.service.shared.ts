import type {
  RoastCurveEvent,
  RoastCurveMetrics,
  RoastCurvePhase,
  RoastCurvePoint,
  RoastCurveRecord,
} from '../../types/roastCurve';

const getStringField = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const getOptionalStringField = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const getNumberField = (value: unknown, fallback = 0): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const getOptionalObject = (value: unknown): object | undefined => {
  return typeof value === 'object' && value != null && !Array.isArray(value) ? value : undefined;
};

const getArrayField = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

export const toPocketBaseRoastCurvePayload = (record: Omit<RoastCurveRecord, 'id'>): Record<string, unknown> => ({
  bean_snapshot: record.beanSnapshot ?? null,
  curve_data: record.curveData,
  device_info: record.deviceInfo ?? null,
  event_list: record.eventList,
  imported_at: record.importedAt,
  metrics: record.metrics,
  original_file_name: record.originalFileName ?? null,
  phase_list: record.phaseList,
  roast_batch_id: record.roastBatchId,
  sample_interval: record.sampleInterval,
  source: record.source,
  source_version: record.sourceVersion,
  temperature_unit: record.temperatureUnit,
});

export const mapRemoteRoastCurveRecord = (record: Record<string, unknown>): RoastCurveRecord => ({
  beanSnapshot: getOptionalObject(record.bean_snapshot),
  curveData: getArrayField(record.curve_data) as RoastCurvePoint[],
  deviceInfo: getOptionalObject(record.device_info),
  eventList: getArrayField(record.event_list) as RoastCurveEvent[],
  id: getStringField(record.id),
  importedAt: getStringField(record.imported_at, getStringField(record.created_at)),
  metrics: (getOptionalObject(record.metrics) as RoastCurveMetrics | undefined) ?? {},
  originalFileName: getOptionalStringField(record.original_file_name),
  phaseList: getArrayField(record.phase_list) as RoastCurvePhase[],
  roastBatchId: getStringField(record.roast_batch_id),
  sampleInterval: getNumberField(record.sample_interval, 1),
  source: 'hibean',
  sourceVersion: getStringField(record.source_version, 'unknown'),
  temperatureUnit: getStringField(record.temperature_unit, 'C'),
  updatedAt: getStringField(record.updated_at),
});

export const getBatchSummaryFromCurve = (
  record: RoastCurveRecord,
): {
  developmentRatio?: number;
  firstCrackTime?: number;
  totalRoastTime?: number;
} => ({
  developmentRatio: record.metrics.developmentRatio,
  firstCrackTime: record.metrics.firstCrackTime,
  totalRoastTime: record.metrics.roastDuration,
});
