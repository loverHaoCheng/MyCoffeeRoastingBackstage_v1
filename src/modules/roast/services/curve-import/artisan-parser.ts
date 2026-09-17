import type {
  RoastCurveBeanSnapshot,
  RoastCurveDeviceInfo,
  RoastCurveEvent,
  RoastCurvePhase,
  RoastCurvePoint,
} from '../../types/roastCurve';
import { ARTISAN_EVENT_META, ARTISAN_PHASE_META } from './curve-constants';
import {
  getFiniteUnknownNumber,
  getNumberArray,
  getRecord,
  getString,
  getValidTemperature,
  isValidArrayIndex,
  roundTimeSeconds,
} from './curve-utils';
import { getNearestPointTemperature } from './curve-metrics';

const getArtisanTimeIndexValue = (timeindex: number[], position: number): number | undefined => {
  const value = timeindex[position];

  return value != null && Number.isInteger(value) && value > 0 ? value : undefined;
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

export const getArtisanDropIndex = (
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

export const getArtisanSeriesChoice = (
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

export const normalizeArtisanPoints = (
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

export const normalizeArtisanEvents = (
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

export const normalizeArtisanPhases = (computed: Record<string, unknown>, roastDuration: number | undefined): RoastCurvePhase[] => {
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

export const getArtisanBeanSnapshot = (payload: Record<string, unknown>, computed: Record<string, unknown>): RoastCurveBeanSnapshot | undefined => {
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

export const getArtisanDeviceInfo = (payload: Record<string, unknown>): RoastCurveDeviceInfo => {
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

export const parseArtisanPayload = (jsonText: string) => {
  const rawPayload = JSON.parse(jsonText);
  const payload = getRecord(rawPayload);
  const computed = getRecord(payload?.computed);
  const timex = getNumberArray(payload?.timex);
  const temp1 = getNumberArray(payload?.temp1);
  const temp2 = getNumberArray(payload?.temp2);
  const timeindex = getNumberArray(payload?.timeindex);

  if (!payload || !computed || timex.length === 0 || (temp1.length === 0 && temp2.length === 0)) {
    return null;
  }

  return { computed, payload, temp1, temp2, timeindex, timex };
};

export const getArtisanChargeIndex = (timeindex: number[], timex: number[]): number => {
  const indexedCharge = getArtisanTimeIndexValue(timeindex, 0);

  return isValidArrayIndex(indexedCharge, timex.length) ? indexedCharge : 0;
};
