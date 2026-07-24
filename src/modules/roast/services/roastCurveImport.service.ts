import { AppError } from '@/shared/errors/AppError';

import {
  type HiBeanRoastCurve,
  type HiBeanRoastCurveEvent,
  type HiBeanRoastCurvePhase,
  hibeanRoastCurveSchema,
} from '../schemas/hibeanRoastCurve.schema';
import type {
  RoastCurveBeanSnapshot,
  RoastCurveDeviceInfo,
  RoastCurveEvent,
  RoastCurveEventType,
  RoastCurveMetrics,
  RoastCurvePhase,
  RoastCurvePoint,
  RoastCurveRecord,
} from '../types/roastCurve';

const HIBEAN_EVENT_META: Record<number, { label: string; type: RoastCurveEventType }> = {
  0: { label: '预热', type: 'preheat' },
  1: { label: '入豆', type: 'charge' },
  2: { label: '回温点', type: 'turningPoint' },
  3: { label: '脱水结束', type: 'dryEnd' },
  4: { label: '一爆开始', type: 'firstCrackStart' },
  5: { label: '一爆结束', type: 'firstCrackEnd' },
  8: { label: '下豆', type: 'drop' },
};

const HIBEAN_PHASE_LABELS: Record<number, string> = {
  2: '脱水',
  3: '梅纳',
  4: '发展',
};

const ARTISAN_EVENT_META: Record<
  string,
  { btKey: string; code: number; etKey: string; label: string; timeKey: string; type: RoastCurveEventType }
> = {
  charge: {
    btKey: 'CHARGE_BT',
    code: 1,
    etKey: 'CHARGE_ET',
    label: '入豆',
    timeKey: 'CHARGE_time',
    type: 'charge',
  },
  dryEnd: {
    btKey: 'DRY_BT',
    code: 3,
    etKey: 'DRY_ET',
    label: '脱水结束',
    timeKey: 'DRY_time',
    type: 'dryEnd',
  },
  firstCrackStart: {
    btKey: 'FCs_BT',
    code: 4,
    etKey: 'FCs_ET',
    label: '一爆开始',
    timeKey: 'FCs_time',
    type: 'firstCrackStart',
  },
  firstCrackEnd: {
    btKey: 'FCe_BT',
    code: 5,
    etKey: 'FCe_ET',
    label: '一爆结束',
    timeKey: 'FCe_time',
    type: 'firstCrackEnd',
  },
  drop: {
    btKey: 'DROP_BT',
    code: 8,
    etKey: 'DROP_ET',
    label: '下豆',
    timeKey: 'DROP_time',
    type: 'drop',
  },
};

const ARTISAN_PHASE_META = [
  { durationKey: 'dryphasetime', label: '脱水', phase: 2 },
  { durationKey: 'midphasetime', label: '梅纳', phase: 3 },
  { durationKey: 'finishphasetime', label: '发展', phase: 4 },
] as const;

const getFiniteNumber = (value: number | undefined): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const getFiniteUnknownNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const getValidTemperature = (value: unknown): number | undefined => {
  const numberValue = getFiniteUnknownNumber(value);

  return numberValue != null && numberValue > 0 ? numberValue : undefined;
};

const getRecord = (value: unknown): Record<string, unknown> | undefined => {
  return typeof value === 'object' && value != null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
};

const getNumberArray = (value: unknown): number[] => {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : [];
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const roundTimeSeconds = (value: number): number => Math.round(value * 1000) / 1000;

const isValidArrayIndex = (index: number | undefined, length: number): index is number => {
  return index != null && Number.isInteger(index) && index >= 0 && index < length;
};

const getParamValue = (params: { key: string; value: number }[] | undefined, key: string): number | undefined => {
  return getFiniteNumber(params?.find((item) => item.key === key)?.value);
};

const normalizeHibeanPoint = (point: HiBeanRoastCurve['dataList'][number]): RoastCurvePoint => {
  const environmentTemperature = getFiniteNumber(point.et);

  return {
    beanTemperature: getFiniteNumber(point.bt),
    drumSpeed: getParamValue(point.roasterParams, 'RC'),
    environmentTemperature: environmentTemperature === 0 ? undefined : environmentTemperature,
    fanSpeed: getParamValue(point.roasterParams, 'FC'),
    heatPower: getParamValue(point.roasterParams, 'HP'),
    rateOfRise: getFiniteNumber(point.ror),
    timeSeconds: point.duration,
  };
};

const normalizeHibeanEvent = (event: HiBeanRoastCurveEvent, temperatureUnit: string): RoastCurveEvent => {
  const meta = HIBEAN_EVENT_META[event.event] ?? {
    label: `事件 ${String(event.event)}`,
    type: 'unknown' as const,
  };

  return {
    code: event.event,
    label: meta.label,
    temperature: getFiniteNumber(event.temperature),
    temperatureUnit: event.temperatureUnit ?? temperatureUnit,
    timeSeconds: event.time,
    type: meta.type,
  };
};

const normalizeHibeanPhase = (phase: HiBeanRoastCurvePhase): RoastCurvePhase => ({
  durationSeconds: phase.duration,
  label: HIBEAN_PHASE_LABELS[phase.phase] ?? `阶段 ${String(phase.phase)}`,
  percentage: phase.percentage,
  phase: phase.phase,
});

const findEvent = (events: RoastCurveEvent[], type: RoastCurveEventType): RoastCurveEvent | undefined => {
  return events.find((event) => event.type === type);
};

const deriveMetrics = (
  sourceDuration: number | undefined,
  events: RoastCurveEvent[],
  points: RoastCurvePoint[],
): RoastCurveMetrics => {
  const charge = findEvent(events, 'charge');
  const turningPoint = findEvent(events, 'turningPoint');
  const dryEnd = findEvent(events, 'dryEnd');
  const firstCrack = findEvent(events, 'firstCrackStart');
  const drop = findEvent(events, 'drop');
  const latestRoastPoint = points.filter((point) => point.timeSeconds >= 0).at(-1);
  const roastDuration = drop?.timeSeconds ?? sourceDuration ?? latestRoastPoint?.timeSeconds;
  const developmentTime =
    firstCrack?.timeSeconds != null && roastDuration != null
      ? Math.max(0, roastDuration - firstCrack.timeSeconds)
      : undefined;
  const developmentRatio =
    developmentTime != null && roastDuration != null && roastDuration > 0
      ? (developmentTime / roastDuration) * 100
      : undefined;

  return {
    chargeTemperature: charge?.temperature,
    chargeTime: charge?.timeSeconds,
    developmentRatio,
    developmentTime,
    dryEndTemperature: dryEnd?.temperature,
    dryEndTime: dryEnd?.timeSeconds,
    dropTemperature: drop?.temperature,
    dropTime: drop?.timeSeconds,
    firstCrackTemperature: firstCrack?.temperature,
    firstCrackTime: firstCrack?.timeSeconds,
    roastDuration,
    turningPointTemperature: turningPoint?.temperature,
    turningPointTime: turningPoint?.timeSeconds,
  };
};

const getDeviceInfo = (curve: HiBeanRoastCurve): RoastCurveDeviceInfo | undefined => {
  if (!curve.deviceInfo) {
    return undefined;
  }

  return {
    manufacturer: curve.deviceInfo.manufacturer,
    model: curve.deviceInfo.model,
    name: curve.deviceInfo.name,
  };
};

const getBeanSnapshot = (curve: HiBeanRoastCurve): RoastCurveBeanSnapshot | undefined => {
  const bean = curve.roastContext?.bean;
  const greenBeanWeight = curve.roastContext?.greenBeanWeight;

  if (!bean && greenBeanWeight?.value == null) {
    return undefined;
  }

  return {
    greenBeanWeightGrams: greenBeanWeight?.unit === 'g' ? greenBeanWeight.value ?? undefined : undefined,
    name: bean?.name ?? undefined,
    origin: bean?.origin ?? undefined,
    processingMethod: bean?.processingMethod ?? undefined,
    regionCode: bean?.regionCode ?? undefined,
  };
};

const getNearestPointTemperature = (
  points: RoastCurvePoint[],
  timeSeconds: number,
): number | undefined => {
  return points.reduce<RoastCurvePoint | undefined>((nearest, point) => {
    if (!nearest) {
      return point;
    }

    const currentDistance = Math.abs(point.timeSeconds - timeSeconds);
    const nearestDistance = Math.abs(nearest.timeSeconds - timeSeconds);

    return currentDistance < nearestDistance ? point : nearest;
  }, undefined)?.beanTemperature;
};

const getMedianSampleInterval = (points: RoastCurvePoint[]): number | undefined => {
  const intervals = points
    .slice(1)
    .map((point, index) => {
      const previous = points[index];

      return previous ? point.timeSeconds - previous.timeSeconds : 0;
    })
    .filter((duration) => Number.isFinite(duration) && duration > 0)
    .sort((left, right) => left - right);

  if (intervals.length === 0) {
    return undefined;
  }

  return intervals[Math.floor(intervals.length / 2)];
};

const findNearestIndexByRelativeTime = (
  timex: number[],
  chargeTime: number,
  relativeTime: number | undefined,
): number | undefined => {
  if (relativeTime == null) {
    return undefined;
  }

  return timex.reduce<{ distance: number; index: number } | undefined>((nearest, absoluteTime, index) => {
    const distance = Math.abs(absoluteTime - chargeTime - relativeTime);

    if (!nearest || distance < nearest.distance) {
      return { distance, index };
    }

    return nearest;
  }, undefined)?.index;
};

const getArtisanTimeIndexValue = (timeindex: number[], position: number): number | undefined => {
  const value = timeindex[position];

  return value != null && Number.isInteger(value) && value > 0 ? value : undefined;
};

const getArtisanDropIndex = (
  timex: number[],
  computed: Record<string, unknown>,
  timeindex: number[],
  chargeIndex: number,
): number => {
  const chargeTime = timex[chargeIndex] ?? 0;
  const indexedDrop = getArtisanTimeIndexValue(timeindex, 6);
  const computedDrop = findNearestIndexByRelativeTime(timex, chargeTime, getFiniteUnknownNumber(computed.DROP_time));
  const fallbackDrop = findNearestIndexByRelativeTime(timex, chargeTime, getFiniteUnknownNumber(computed.totaltime));
  const dropIndex = indexedDrop ?? computedDrop ?? fallbackDrop ?? timex.length - 1;

  return isValidArrayIndex(dropIndex, timex.length) && dropIndex >= chargeIndex ? dropIndex : timex.length - 1;
};

const getArtisanSeriesChoice = (
  temp1: number[],
  temp2: number[],
  computed: Record<string, unknown>,
): { beanSeries: number[]; environmentSeries?: number[] } => {
  const validTemp1Count = temp1.filter((value) => getValidTemperature(value) != null).length;
  const validTemp2Count = temp2.filter((value) => getValidTemperature(value) != null).length;
  const hasComputedBeanTemperature = [
    computed.CHARGE_BT,
    computed.DRY_BT,
    computed.FCs_BT,
    computed.FCe_BT,
    computed.DROP_BT,
  ].some((value) => getValidTemperature(value) != null);

  if ((hasComputedBeanTemperature || validTemp2Count > 0) && validTemp2Count >= Math.max(3, validTemp1Count * 0.1)) {
    return { beanSeries: temp2, environmentSeries: temp1 };
  }

  return {
    beanSeries: temp1,
    environmentSeries: validTemp2Count > 0 ? temp2 : undefined,
  };
};

const calculateRateOfRise = (
  current: RoastCurvePoint,
  previous: RoastCurvePoint | undefined,
): number | undefined => {
  if (current.beanTemperature == null || previous?.beanTemperature == null) {
    return undefined;
  }

  const elapsedSeconds = current.timeSeconds - previous.timeSeconds;

  if (elapsedSeconds <= 0) {
    return undefined;
  }

  return Math.round(((current.beanTemperature - previous.beanTemperature) / elapsedSeconds) * 600) / 10;
};

const normalizeArtisanPoints = (
  timex: number[],
  beanSeries: number[],
  environmentSeries: number[] | undefined,
  chargeIndex: number,
  dropIndex: number,
): RoastCurvePoint[] => {
  const chargeTime = timex[chargeIndex] ?? 0;
  const points: RoastCurvePoint[] = [];

  for (let index = chargeIndex; index <= dropIndex; index += 1) {
    const beanTemperature = getValidTemperature(beanSeries[index]);

    if (beanTemperature == null) {
      continue;
    }

    const point: RoastCurvePoint = {
      beanTemperature,
      environmentTemperature: getValidTemperature(environmentSeries?.[index]),
      timeSeconds: roundTimeSeconds((timex[index] ?? chargeTime) - chargeTime),
    };

    point.rateOfRise = calculateRateOfRise(point, points.at(-1));
    points.push(point);
  }

  return points;
};

const normalizeArtisanEvents = (
  computed: Record<string, unknown>,
  points: RoastCurvePoint[],
  temperatureUnit: string,
): RoastCurveEvent[] => {
  return Object.values(ARTISAN_EVENT_META)
    .reduce<RoastCurveEvent[]>((events, meta) => {
      const rawTime = meta.type === 'charge' ? 0 : getFiniteUnknownNumber(computed[meta.timeKey]);

      if (rawTime == null) {
        return events;
      }

      const temperature =
        getValidTemperature(computed[meta.btKey]) ??
        getValidTemperature(computed[meta.etKey]) ??
        getNearestPointTemperature(points, rawTime);

      events.push({
        code: meta.code,
        label: meta.label,
        temperature,
        temperatureUnit,
        timeSeconds: rawTime,
        type: meta.type,
      });

      return events;
    }, [])
    .sort((left, right) => left.timeSeconds - right.timeSeconds);
};

const normalizeArtisanPhases = (computed: Record<string, unknown>, roastDuration: number | undefined): RoastCurvePhase[] => {
  return ARTISAN_PHASE_META.map((meta) => {
    const durationSeconds = getFiniteUnknownNumber(computed[meta.durationKey]) ?? 0;

    return {
      durationSeconds,
      label: meta.label,
      percentage: roastDuration != null && roastDuration > 0 ? (durationSeconds / roastDuration) * 100 : 0,
      phase: meta.phase,
    };
  }).filter((phase) => phase.durationSeconds > 0);
};

const getArtisanBeanSnapshot = (payload: Record<string, unknown>, computed: Record<string, unknown>): RoastCurveBeanSnapshot | undefined => {
  const weight = Array.isArray(payload.weight) ? payload.weight : [];
  const rawWeight = getFiniteUnknownNumber(weight[0]);
  const weightUnit = getString(weight[2]);
  const computedWeight = getFiniteUnknownNumber(computed.weightin);
  const greenBeanWeightGrams =
    rawWeight != null && rawWeight > 0
      ? weightUnit === 'Kg'
        ? rawWeight * 1000
        : rawWeight
      : computedWeight != null && computedWeight > 0
        ? computedWeight
        : undefined;
  const name = getString(payload.beans);

  if (!name && greenBeanWeightGrams == null) {
    return undefined;
  }

  return {
    greenBeanWeightGrams,
    name,
  };
};

const getArtisanDeviceInfo = (payload: Record<string, unknown>): RoastCurveDeviceInfo => {
  const devices = Array.isArray(payload.devices)
    ? payload.devices.map(getString).filter((value): value is string => value != null)
    : [];
  const deviceModel = getString(payload.roastertype) ?? devices.join(', ');

  return {
    manufacturer: 'Artisan',
    model: deviceModel || undefined,
    name: getString(payload.title) ?? 'Artisan',
  };
};

export const parseArtisanRoastCurveJson = (
  jsonText: string,
  roastBatchId: string,
  fileName?: string,
): Omit<RoastCurveRecord, 'id'> => {
  let rawPayload: unknown;

  try {
    rawPayload = JSON.parse(jsonText);
  } catch (error) {
    throw new AppError('Artisan JSON 解析失败，请确认文件内容是有效 JSON。', {
      code: 'DATA',
      cause: error,
    });
  }

  const payload = getRecord(rawPayload);
  const computed = getRecord(payload?.computed);
  const timex = getNumberArray(payload?.timex);
  const temp1 = getNumberArray(payload?.temp1);
  const temp2 = getNumberArray(payload?.temp2);
  const timeindex = getNumberArray(payload?.timeindex);

  if (!payload || !computed || timex.length === 0 || (temp1.length === 0 && temp2.length === 0)) {
    throw new AppError('Artisan JSON 缺少必要曲线字段。', { code: 'DATA' });
  }

  const indexedCharge = getArtisanTimeIndexValue(timeindex, 0);
  const chargeIndex = isValidArrayIndex(indexedCharge, timex.length) ? indexedCharge : 0;

  const dropIndex = getArtisanDropIndex(timex, computed, timeindex, chargeIndex);
  const now = new Date().toISOString();
  const temperatureUnit = getString(payload.mode) === 'F' ? 'F' : 'C';
  const { beanSeries, environmentSeries } = getArtisanSeriesChoice(temp1, temp2, computed);
  const curveData = normalizeArtisanPoints(timex, beanSeries, environmentSeries, chargeIndex, dropIndex);

  if (curveData.length === 0) {
    throw new AppError('Artisan JSON 未读取到有效温度曲线。', { code: 'DATA' });
  }

  const eventList = normalizeArtisanEvents(computed, curveData, temperatureUnit);
  const roastDuration = getFiniteUnknownNumber(computed.totaltime) ?? getFiniteUnknownNumber(computed.DROP_time);
  const phaseList = normalizeArtisanPhases(computed, roastDuration);
  const metrics = deriveMetrics(roastDuration, eventList, curveData);

  return {
    beanSnapshot: getArtisanBeanSnapshot(payload, computed),
    curveData,
    deviceInfo: getArtisanDeviceInfo(payload),
    eventList,
    importedAt: now,
    metrics,
    originalFileName: fileName,
    phaseList,
    roastBatchId,
    sampleInterval: getFiniteUnknownNumber(payload.samplinginterval) ?? getMedianSampleInterval(curveData) ?? 1,
    source: 'artisan',
    sourceVersion: getString(payload.version) ?? getString(payload.recording_version) ?? 'unknown',
    temperatureUnit,
    updatedAt: now,
  };
};

export const parseHibeanRoastCurveJson = (
  jsonText: string,
  roastBatchId: string,
  fileName?: string,
): Omit<RoastCurveRecord, 'id'> => {
  let payload: unknown;

  try {
    payload = JSON.parse(jsonText);
  } catch (error) {
    throw new AppError('HiBean JSON 解析失败，请确认文件内容是有效 JSON。', {
      code: 'DATA',
      cause: error,
    });
  }

  const parsed = hibeanRoastCurveSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError('HiBean JSON 缺少必要曲线字段。', {
      code: 'DATA',
      cause: parsed.error.flatten(),
    });
  }

  const curve = parsed.data;
  const now = new Date().toISOString();
  const temperatureUnit = curve.temperatureUnit ?? 'C';
  const curveData = curve.dataList.map(normalizeHibeanPoint);
  const eventList = (curve.eventList ?? [])
    .map((event) => normalizeHibeanEvent(event, temperatureUnit))
    .sort((left, right) => left.timeSeconds - right.timeSeconds);
  const phaseList = (curve.phaseList ?? []).map(normalizeHibeanPhase);
  const metrics = deriveMetrics(curve.duration, eventList, curveData);

  return {
    beanSnapshot: getBeanSnapshot(curve),
    curveData,
    deviceInfo: getDeviceInfo(curve),
    eventList,
    importedAt: now,
    metrics,
    originalFileName: fileName,
    phaseList,
    roastBatchId,
    sampleInterval: curve.sampleInterval ?? 1,
    source: 'hibean',
    sourceVersion: curve.version ?? 'unknown',
    temperatureUnit,
    updatedAt: now,
  };
};

export const parseRoastCurveJson = (
  jsonText: string,
  roastBatchId: string,
  fileName?: string,
): Omit<RoastCurveRecord, 'id'> => {
  let payload: unknown;

  try {
    payload = JSON.parse(jsonText);
  } catch (error) {
    throw new AppError('曲线 JSON 解析失败，请确认文件内容是有效 JSON。', {
      code: 'DATA',
      cause: error,
    });
  }

  const record = getRecord(payload);

  if (Array.isArray(record?.dataList)) {
    return parseHibeanRoastCurveJson(jsonText, roastBatchId, fileName);
  }

  if (Array.isArray(record?.timex) && (Array.isArray(record.temp1) || Array.isArray(record.temp2))) {
    return parseArtisanRoastCurveJson(jsonText, roastBatchId, fileName);
  }

  throw new AppError('曲线 JSON 缺少可识别的曲线字段，目前支持 HiBean JSON 与 Artisan JSON。', {
    code: 'DATA',
  });
};
