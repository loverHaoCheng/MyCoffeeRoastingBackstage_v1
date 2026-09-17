import { AppError } from '@/shared/errors/AppError';

import { hibeanRoastCurveSchema } from '../schemas/hibeanRoastCurve.schema';
import type { RoastCurveRecord } from '../types/roastCurve';
import {
  getArtisanBeanSnapshot,
  getArtisanChargeIndex,
  getArtisanDeviceInfo,
  getArtisanDropIndex,
  getArtisanSeriesChoice,
  normalizeArtisanEvents,
  normalizeArtisanPhases,
  normalizeArtisanPoints,
  parseArtisanPayload,
} from './curve-import/artisan-parser';
import { deriveMetrics, getMedianSampleInterval } from './curve-import/curve-metrics';
import { getFiniteUnknownNumber, getRecord, getString } from './curve-import/curve-utils';
import {
  getBeanSnapshot,
  getDeviceInfo,
  normalizeHibeanEvent,
  normalizeHibeanPhase,
  normalizeHibeanPoint,
} from './curve-import/hibean-normalizers';

export const parseArtisanRoastCurveJson = (
  jsonText: string,
  roastBatchId: string,
  fileName?: string,
): Omit<RoastCurveRecord, 'id'> => {
  let parsed;

  try {
    parsed = parseArtisanPayload(jsonText);
  } catch (error) {
    throw new AppError('Artisan JSON 解析失败，请确认文件内容是有效 JSON。', {
      code: 'DATA',
      cause: error,
    });
  }

  if (!parsed) {
    throw new AppError('Artisan JSON 缺少必要曲线字段。', { code: 'DATA' });
  }

  const { computed, payload, temp1, temp2, timeindex, timex } = parsed;
  const chargeIndex = getArtisanChargeIndex(timeindex, timex);
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
