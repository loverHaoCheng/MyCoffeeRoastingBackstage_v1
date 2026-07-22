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

const getFiniteNumber = (value: number | undefined): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
