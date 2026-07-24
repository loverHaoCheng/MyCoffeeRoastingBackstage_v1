import type {
  RoastCurveEvent,
  RoastCurveMetrics,
  RoastCurvePhase,
  RoastCurvePoint,
  RoastCurveRecord,
  RoastCurveSource,
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

const getOptionalNumberField = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const getOptionalObject = (value: unknown): object | undefined => {
  return typeof value === 'object' && value != null && !Array.isArray(value) ? value : undefined;
};

const getRecordField = (record: Record<string, unknown>, fieldNames: string[]): unknown => {
  for (const fieldName of fieldNames) {
    if (record[fieldName] !== undefined) {
      return record[fieldName];
    }
  }

  return undefined;
};

const getArrayField = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

const getCurveSource = (value: unknown): RoastCurveSource => {
  return value === 'artisan' ? 'artisan' : 'hibean';
};

const normalizeCurvePoint = (value: unknown): RoastCurvePoint | null => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const timeSeconds = getOptionalNumberField(getRecordField(record, ['timeSeconds', 'time_seconds', 'duration']));

  if (timeSeconds == null) {
    return null;
  }

  return {
    beanTemperature: getOptionalNumberField(getRecordField(record, ['beanTemperature', 'bean_temperature', 'bt'])),
    drumSpeed: getOptionalNumberField(getRecordField(record, ['drumSpeed', 'drum_speed', 'drum'])),
    environmentTemperature: getOptionalNumberField(getRecordField(record, ['environmentTemperature', 'environment_temperature', 'et'])),
    fanSpeed: getOptionalNumberField(getRecordField(record, ['fanSpeed', 'fan_speed', 'fan'])),
    heatPower: getOptionalNumberField(getRecordField(record, ['heatPower', 'heat_power', 'firePower', 'fire_power', 'power'])),
    rateOfRise: getOptionalNumberField(getRecordField(record, ['rateOfRise', 'rate_of_rise', 'ror'])),
    timeSeconds,
  };
};

const normalizeCurveEvent = (value: unknown): RoastCurveEvent | null => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const timeSeconds = getOptionalNumberField(getRecordField(record, ['timeSeconds', 'time_seconds']));

  if (timeSeconds == null) {
    return null;
  }

  return {
    code: getNumberField(record.code),
    label: getStringField(record.label, '节点'),
    temperature: getOptionalNumberField(record.temperature),
    temperatureUnit: getStringField(record.temperatureUnit, getStringField(record.temperature_unit, 'C')),
    timeSeconds,
    type: (
      [
        'preheat',
        'charge',
        'turningPoint',
        'dryEnd',
        'firstCrackStart',
        'firstCrackEnd',
        'drop',
        'unknown',
      ].includes(getStringField(record.type))
        ? getStringField(record.type)
        : 'unknown'
    ) as RoastCurveEvent['type'],
  };
};

const normalizeCurvePhase = (value: unknown): RoastCurvePhase | null => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const durationSeconds = getOptionalNumberField(getRecordField(record, ['durationSeconds', 'duration_seconds']));

  if (durationSeconds == null) {
    return null;
  }

  return {
    durationSeconds,
    label: getStringField(record.label, '阶段'),
    percentage: getNumberField(record.percentage),
    phase: getNumberField(record.phase),
  };
};

const normalizeMetrics = (value: unknown): RoastCurveMetrics => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;

  return {
    chargeTemperature: getOptionalNumberField(getRecordField(record, ['chargeTemperature', 'charge_temperature'])),
    chargeTime: getOptionalNumberField(getRecordField(record, ['chargeTime', 'charge_time'])),
    developmentRatio: getOptionalNumberField(getRecordField(record, ['developmentRatio', 'development_ratio'])),
    developmentTime: getOptionalNumberField(getRecordField(record, ['developmentTime', 'development_time'])),
    dryEndTemperature: getOptionalNumberField(getRecordField(record, ['dryEndTemperature', 'dry_end_temperature'])),
    dryEndTime: getOptionalNumberField(getRecordField(record, ['dryEndTime', 'dry_end_time'])),
    dropTemperature: getOptionalNumberField(getRecordField(record, ['dropTemperature', 'drop_temperature'])),
    dropTime: getOptionalNumberField(getRecordField(record, ['dropTime', 'drop_time'])),
    firstCrackTemperature: getOptionalNumberField(getRecordField(record, ['firstCrackTemperature', 'first_crack_temperature'])),
    firstCrackTime: getOptionalNumberField(getRecordField(record, ['firstCrackTime', 'first_crack_time'])),
    roastDuration: getOptionalNumberField(getRecordField(record, ['roastDuration', 'roast_duration', 'totalTimeSeconds', 'total_time_seconds'])),
    turningPointTemperature: getOptionalNumberField(getRecordField(record, ['turningPointTemperature', 'turning_point_temperature'])),
    turningPointTime: getOptionalNumberField(getRecordField(record, ['turningPointTime', 'turning_point_time'])),
  };
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
  curveData: getArrayField(record.curve_data).map(normalizeCurvePoint).filter((point): point is RoastCurvePoint => point != null),
  deviceInfo: getOptionalObject(record.device_info),
  eventList: getArrayField(record.event_list).map(normalizeCurveEvent).filter((event): event is RoastCurveEvent => event != null),
  id: getStringField(record.id),
  importedAt: getStringField(record.imported_at, getStringField(record.created_at)),
  metrics: normalizeMetrics(record.metrics),
  originalFileName: getOptionalStringField(record.original_file_name),
  phaseList: getArrayField(record.phase_list).map(normalizeCurvePhase).filter((phase): phase is RoastCurvePhase => phase != null),
  roastBatchId: getStringField(record.roast_batch_id),
  sampleInterval: getNumberField(record.sample_interval, 1),
  source: getCurveSource(record.source),
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
