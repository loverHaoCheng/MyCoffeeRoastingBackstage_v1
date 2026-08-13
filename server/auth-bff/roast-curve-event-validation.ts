import { isRecord, toTrimmedString } from './utils.js';

const editableEventTypes = ['charge', 'turningPoint', 'dryEnd', 'firstCrackStart', 'firstCrackEnd', 'drop'] as const;

const getNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const getTimeSeconds = (record: Record<string, unknown>): number | null => {
  return getNumber(record.timeSeconds) ?? getNumber(record.time_seconds);
};

const getNearestPointIndex = (points: Record<string, unknown>[], timeSeconds: number): number => {
  return points.reduce((nearestIndex, point, index) => {
    const pointTime = getTimeSeconds(point) ?? 0;
    const nearestTime = getTimeSeconds(points[nearestIndex] ?? {}) ?? 0;

    return Math.abs(pointTime - timeSeconds) < Math.abs(nearestTime - timeSeconds) ? index : nearestIndex;
  }, 0);
};

const getEventIndex = (
  events: Record<string, unknown>[],
  points: Record<string, unknown>[],
  overrides: Record<string, unknown>,
  type: string,
): number | null => {
  const override = overrides[type];

  if (override !== undefined) {
    if (!isRecord(override)) {
      return null;
    }

    const sampleIndex = getNumber(override.sampleIndex);

    return sampleIndex != null && Number.isInteger(sampleIndex) && sampleIndex >= 0 && sampleIndex < points.length
      ? sampleIndex
      : null;
  }

  const event = events.find((item) => toTrimmedString(item.type) === type);
  const eventTime = event ? getTimeSeconds(event) : null;

  return eventTime != null && points.length > 0 ? getNearestPointIndex(points, eventTime) : null;
};

export const validateRoastCurveEventOverrideOrder = (curve: Record<string, unknown>): string | null => {
  const points = Array.isArray(curve.curve_data) ? curve.curve_data.filter(isRecord) : [];
  const events = Array.isArray(curve.event_list) ? curve.event_list.filter(isRecord) : [];

  if (curve.event_overrides != null && !isRecord(curve.event_overrides)) {
    return '曲线关键点数据格式无效。';
  }

  const overrides = isRecord(curve.event_overrides) ? curve.event_overrides : {};
  let previousIndex = -1;

  for (const type of editableEventTypes) {
    const index = getEventIndex(events, points, overrides, type);

    if (overrides[type] !== undefined && index == null) {
      return `${type} 关键点必须选择有效的曲线采样点。`;
    }

    if (index != null && index < previousIndex) {
      return '曲线关键点顺序无效，请按入豆、回温点、转黄、一爆和下豆的先后顺序调整。';
    }

    if (index != null) {
      previousIndex = index;
    }
  }

  return null;
};
