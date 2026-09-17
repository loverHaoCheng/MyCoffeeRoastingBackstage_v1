import type {
  HiBeanRoastCurve,
  HiBeanRoastCurveEvent,
  HiBeanRoastCurvePhase,
} from '../../schemas/hibeanRoastCurve.schema';
import type {
  RoastCurveBeanSnapshot,
  RoastCurveDeviceInfo,
  RoastCurveEvent,
  RoastCurvePhase,
  RoastCurvePoint,
} from '../../types/roastCurve';
import { HIBEAN_EVENT_META, HIBEAN_PHASE_LABELS } from './curve-constants';
import { getFiniteNumber, getParamValue } from './curve-utils';

export const normalizeHibeanPoint = (point: HiBeanRoastCurve['dataList'][number]): RoastCurvePoint => {
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

export const normalizeHibeanEvent = (event: HiBeanRoastCurveEvent, temperatureUnit: string): RoastCurveEvent => {
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

export const normalizeHibeanPhase = (phase: HiBeanRoastCurvePhase): RoastCurvePhase => ({
  durationSeconds: phase.duration,
  label: HIBEAN_PHASE_LABELS[phase.phase] ?? `阶段 ${String(phase.phase)}`,
  percentage: phase.percentage,
  phase: phase.phase,
});

export const getDeviceInfo = (curve: HiBeanRoastCurve): RoastCurveDeviceInfo | undefined => {
  if (!curve.deviceInfo) {
    return undefined;
  }

  return {
    manufacturer: curve.deviceInfo.manufacturer,
    model: curve.deviceInfo.model,
    name: curve.deviceInfo.name,
  };
};

export const getBeanSnapshot = (curve: HiBeanRoastCurve): RoastCurveBeanSnapshot | undefined => {
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
