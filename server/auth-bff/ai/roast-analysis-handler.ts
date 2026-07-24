import type { IncomingMessage, ServerResponse } from 'node:http';

import { refreshAuthenticatedSession } from '../auth-common.js';
import { AI_FEATURE_ROAST_ANALYSIS } from '../config.js';
import { parseLimitedJsonBody, sendApiError, sendApiSuccess } from '../http.js';
import { normalizeErrorPayload, proxyPocketBaseRequest } from '../pocketbase-client.js';
import { escapeFilterValue, getFirstListItem, listPocketBaseRecords } from '../record-utils.js';
import { PocketBaseGatewayError } from '../types.js';
import { isRecord, toTrimmedString } from '../utils.js';
import { parseRoastAnalysisPayload, type RoastAnalysisRequest } from './roast-analysis-types.js';
import { requestRoastAnalysis } from './roast-analysis-client.js';
import {
  createSuccessfulRoastAiUsage,
  ensureRoastAiUsageAvailable,
  logRoastAiUsageFailure,
  readRoastAiUsageContext,
  type RoastAiUsageContext,
} from './roast-usage-handler.js';

const MAX_ANALYSIS_REQUEST_BYTES = 48 * 1024;
const AI_ROAST_REVIEWS_COLLECTION = 'ai_roast_reviews';
const ROAST_BATCHES_COLLECTION = 'roast_batches';
const ROAST_CURVES_COLLECTION = 'roast_curve_records';
const ROAST_PLANS_COLLECTION = 'roast_profiles';
const ROASTING_MACHINES_COLLECTION = 'roasting_machines';
const MAX_CURVE_SAMPLES = 12;
const MAX_PLAN_STEPS = 16;

class RoastAnalysisReadinessError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const getGenerationModel = (record: Record<string, unknown>): string => {
  return isRecord(record.generation_meta) ? toTrimmedString(record.generation_meta.model) : '';
};

const toFiniteNumber = (value: unknown): null | number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const roundMetric = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const roundNullable = (value: null | number): null | number => (value == null ? null : roundMetric(value));

const getArray = (value: unknown): Record<string, unknown>[] => {
  return Array.isArray(value) ? value.filter(isRecord) : [];
};

const getFirstNumber = (record: Record<string, unknown>, fieldNames: string[]): null | number => {
  for (const fieldName of fieldNames) {
    const value = toFiniteNumber(record[fieldName]);

    if (value != null) {
      return value;
    }
  }

  return null;
};

const curveFieldAliases: Record<string, string[]> = {
  beanTemperature: ['beanTemperature', 'bean_temperature', 'bt'],
  drumSpeed: ['drumSpeed', 'drum_speed', 'drum'],
  environmentTemperature: ['environmentTemperature', 'environment_temperature', 'et'],
  fanSpeed: ['fanSpeed', 'fan_speed', 'fan'],
  heatPower: ['heatPower', 'heat_power', 'firePower', 'fire_power', 'power'],
  rateOfRise: ['rateOfRise', 'rate_of_rise', 'ror'],
  timeSeconds: ['timeSeconds', 'time_seconds', 'duration'],
};

const metricFieldAliases: Record<string, string[]> = {
  chargeTemperature: ['chargeTemperature', 'charge_temperature'],
  developmentRatio: ['developmentRatio', 'development_ratio'],
  developmentTime: ['developmentTime', 'development_time'],
  dryEndTemperature: ['dryEndTemperature', 'dry_end_temperature'],
  dryEndTime: ['dryEndTime', 'dry_end_time'],
  dropTemperature: ['dropTemperature', 'drop_temperature'],
  dropTime: ['dropTime', 'drop_time'],
  firstCrackTemperature: ['firstCrackTemperature', 'first_crack_temperature'],
  firstCrackTime: ['firstCrackTime', 'first_crack_time'],
  roastDuration: ['roastDuration', 'roast_duration', 'totalTimeSeconds', 'total_time_seconds'],
  turningPointTemperature: ['turningPointTemperature', 'turning_point_temperature'],
  turningPointTime: ['turningPointTime', 'turning_point_time'],
};

const average = (values: number[]): null | number => {
  if (values.length === 0) {
    return null;
  }

  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const collectFieldValues = (points: Record<string, unknown>[], field: string): number[] => {
  return points
    .map((point) => getFirstNumber(point, curveFieldAliases[field] ?? [field]))
    .filter((value): value is number => value != null);
};

const getNearestPointValue = (
  points: Record<string, unknown>[],
  timeSeconds: null | number,
  field = 'rateOfRise',
): null | number => {
  if (timeSeconds == null || points.length === 0) {
    return null;
  }

  const nearest = points.reduce<Record<string, unknown> | null>((currentNearest, point) => {
    if (!currentNearest) {
      return point;
    }

    const pointTime = getFirstNumber(point, curveFieldAliases.timeSeconds) ?? 0;
    const nearestTime = getFirstNumber(currentNearest, curveFieldAliases.timeSeconds) ?? 0;

    return Math.abs(pointTime - timeSeconds) < Math.abs(nearestTime - timeSeconds) ? point : currentNearest;
  }, null);

  return nearest ? roundNullable(getFirstNumber(nearest, curveFieldAliases[field] ?? [field])) : null;
};

const summarizeSeries = (values: number[]): Record<string, null | number> => {
  if (values.length === 0) {
    return { average: null, end: null, max: null, min: null };
  }

  const firstValue = values[0];
  const lastValue = values[values.length - 1] ?? firstValue;

  return {
    average: average(values),
    end: roundMetric(lastValue),
    max: roundMetric(Math.max(...values)),
    min: roundMetric(Math.min(...values)),
  };
};

const summarizeRor = (
  points: Record<string, unknown>[],
  metrics: Record<string, unknown>,
): Record<string, null | number> => {
  const positiveValues = collectFieldValues(points, 'rateOfRise').filter((value) => value > 0);
  const lastPositiveValue = positiveValues.length > 0 ? positiveValues[positiveValues.length - 1] : null;

  return {
    averagePositive: average(positiveValues),
    drop: getNearestPointValue(points, getFirstNumber(metrics, metricFieldAliases.dropTime)),
    end: lastPositiveValue == null ? null : roundMetric(lastPositiveValue),
    firstCrack: getNearestPointValue(points, getFirstNumber(metrics, metricFieldAliases.firstCrackTime)),
    maxPositive: positiveValues.length > 0 ? roundMetric(Math.max(...positiveValues)) : null,
    minPositive: positiveValues.length > 0 ? roundMetric(Math.min(...positiveValues)) : null,
  };
};

type RoastAnalysisCurveContext = NonNullable<RoastAnalysisRequest['curve']>;

const toCurveSample = (point: Record<string, unknown>): RoastAnalysisCurveContext['samples'][number] | null => {
  const timeSeconds = getFirstNumber(point, curveFieldAliases.timeSeconds);

  if (timeSeconds == null) {
    return null;
  }

  const beanTemperature = getFirstNumber(point, curveFieldAliases.beanTemperature);
  const drumSpeed = getFirstNumber(point, curveFieldAliases.drumSpeed);
  const environmentTemperature = getFirstNumber(point, curveFieldAliases.environmentTemperature);
  const fanSpeed = getFirstNumber(point, curveFieldAliases.fanSpeed);
  const heatPower = getFirstNumber(point, curveFieldAliases.heatPower);
  const rateOfRise = getFirstNumber(point, curveFieldAliases.rateOfRise);

  return {
    ...(beanTemperature != null ? { beanTemperature: roundMetric(beanTemperature) } : {}),
    ...(drumSpeed != null ? { drumSpeed: roundMetric(drumSpeed) } : {}),
    ...(environmentTemperature != null ? { environmentTemperature: roundMetric(environmentTemperature) } : {}),
    ...(fanSpeed != null ? { fanSpeed: roundMetric(fanSpeed) } : {}),
    ...(heatPower != null ? { heatPower: roundMetric(heatPower) } : {}),
    ...(rateOfRise != null ? { rateOfRise: roundMetric(rateOfRise) } : {}),
    timeSeconds: roundMetric(timeSeconds),
  };
};

const pickCurveSamples = (points: Record<string, unknown>[]): RoastAnalysisCurveContext['samples'] => {
  if (points.length <= MAX_CURVE_SAMPLES) {
    return points.map(toCurveSample).filter((sample): sample is RoastAnalysisCurveContext['samples'][number] => sample != null);
  }

  const lastIndex = points.length - 1;
  const indexes = Array.from({ length: MAX_CURVE_SAMPLES }, (_, index) => Math.round((index * lastIndex) / (MAX_CURVE_SAMPLES - 1)));

  return [...new Set(indexes)]
    .map((index) => toCurveSample(points[index] ?? {}))
    .filter((sample): sample is RoastAnalysisCurveContext['samples'][number] => sample != null);
};

const summarizeEvaluation = (evaluation: Record<string, unknown>): string => {
  return [
    typeof evaluation.overallScore === 'number' ? `整体评分 ${String(evaluation.overallScore)}` : '',
    typeof evaluation.targetMatchScore === 'number' ? `目标匹配 ${String(evaluation.targetMatchScore)}` : '',
    toTrimmedString(evaluation.flavorNotes) ? `风味：${toTrimmedString(evaluation.flavorNotes)}` : '',
    toTrimmedString(evaluation.defectNotes) ? `缺陷：${toTrimmedString(evaluation.defectNotes)}` : '',
    toTrimmedString(evaluation.nextAdjustmentNotes) ? `下次调整：${toTrimmedString(evaluation.nextAdjustmentNotes)}` : '',
  ].filter((part) => part.length > 0).join('；');
};

const getPlanStepText = (step: Record<string, unknown>, primaryKey: string, fallbackKey: string): string => {
  return toTrimmedString(step[primaryKey]) || toTrimmedString(step[fallbackKey]);
};

const getRecordById = async (
  token: string,
  collectionName: string,
  recordId: string,
): Promise<Record<string, unknown> | null> => {
  if (!recordId) {
    return null;
  }

  const upstream = await proxyPocketBaseRequest(`/api/collections/${collectionName}/records/${recordId}`, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'GET',
  });

  if (upstream.response.status === 404) {
    return null;
  }

  if (!upstream.response.ok) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }

  return isRecord(upstream.payload) ? upstream.payload : null;
};

const getCurveByBatchId = async (
  token: string,
  roastBatchId: string,
): Promise<Record<string, unknown> | null> => {
  const payload = await listPocketBaseRecords(token, ROAST_CURVES_COLLECTION, {
    fields: '*',
    filter: `roast_batch_id = ${escapeFilterValue(roastBatchId)}`,
    perPage: 1,
  });

  return getFirstListItem(payload);
};

const getRoastDuration = (
  batch: Record<string, unknown>,
  curve: Record<string, unknown>,
  metrics: Record<string, unknown>,
  points: Record<string, unknown>[],
): number => {
  const fromBatch = toFiniteNumber(batch.total_roast_time);
  const fromMetrics = getFirstNumber(metrics, metricFieldAliases.roastDuration) ?? getFirstNumber(metrics, metricFieldAliases.dropTime);
  const fromLastPoint = points.length > 0 ? getFirstNumber(points[points.length - 1] ?? {}, curveFieldAliases.timeSeconds) : null;

  return [fromBatch, fromMetrics, fromLastPoint].find((value): value is number => value != null && value > 0) ?? 0;
};

const buildRoastAnalysisRequestFromPocketBase = async (
  token: string,
  roastBatchId: string,
): Promise<RoastAnalysisRequest> => {
  const batch = await getRecordById(token, ROAST_BATCHES_COLLECTION, roastBatchId);

  if (!batch) {
    throw new RoastAnalysisReadinessError(404, '未找到这条烘焙记录。');
  }

  const roastPlanId = toTrimmedString(batch.roast_plan_id);
  const plan = await getRecordById(token, ROAST_PLANS_COLLECTION, roastPlanId);

  if (!roastPlanId || !plan) {
    throw new RoastAnalysisReadinessError(422, '请先为这条烘焙记录关联有效的烘焙计划。');
  }

  const machineId = toTrimmedString(plan.roaster_machine_id);
  const machine = await getRecordById(token, ROASTING_MACHINES_COLLECTION, machineId);

  if (!machineId || !machine) {
    throw new RoastAnalysisReadinessError(422, '请先在烘焙计划中选择已关联的实体烘豆机。');
  }

  const curve = await getCurveByBatchId(token, roastBatchId);

  if (!curve) {
    throw new RoastAnalysisReadinessError(422, '请先为这条烘焙记录导入曲线数据。');
  }

  const points = getArray(curve.curve_data);
  const metrics = isRecord(curve.metrics) ? curve.metrics : {};

  if (points.length === 0) {
    throw new RoastAnalysisReadinessError(422, '曲线中没有有效采样点，请重新导入曲线文件。');
  }

  const totalTimeSeconds = getRoastDuration(batch, curve, metrics, points);

  if (totalTimeSeconds <= 0) {
    throw new RoastAnalysisReadinessError(422, '曲线缺少有效的总烘焙时长，请重新导入或检查下豆点。');
  }

  const inputWeight = toFiniteNumber(batch.input_weight_grams);
  const outputWeight = toFiniteNumber(batch.output_weight_grams);
  const weightLossPercent = inputWeight != null && inputWeight > 0 && outputWeight != null && outputWeight > 0
    ? roundMetric(((inputWeight - outputWeight) / inputWeight) * 100)
    : null;
  const evaluation = isRecord(batch.evaluation) ? batch.evaluation : {};
  const planSteps = getArray(plan.steps).slice(0, MAX_PLAN_STEPS).map((step) => ({
    airTemperature: getPlanStepText(step, 'airTemperature', 'air_temperature'),
    drumSpeed: getPlanStepText(step, 'drumSpeed', 'drum_speed'),
    drumTemperature: getPlanStepText(step, 'drumTemperature', 'drum_temperature'),
    eventName: getPlanStepText(step, 'eventName', 'event') || '节点',
    firePower: getPlanStepText(step, 'firePower', 'fire_power'),
    note: getPlanStepText(step, 'note', 'note'),
    operation: getPlanStepText(step, 'operation', 'operation'),
    timeLabel: getPlanStepText(step, 'timeLabel', 'time') || '0:00',
  }));

  return {
    batch: {
      evaluationSummary: summarizeEvaluation(evaluation) || undefined,
      inputWeightGrams: inputWeight,
      notes: toTrimmedString(batch.notes) || undefined,
      outputWeightGrams: outputWeight,
      weightLossPercent,
    },
    curve: {
      controlStats: {
        drumSpeed: summarizeSeries(collectFieldValues(points, 'drumSpeed')),
        environmentTemperature: summarizeSeries(collectFieldValues(points, 'environmentTemperature')),
        fanSpeed: summarizeSeries(collectFieldValues(points, 'fanSpeed')),
        heatPower: summarizeSeries(collectFieldValues(points, 'heatPower')),
      },
      rorStats: summarizeRor(points, metrics),
      samples: pickCurveSamples(points),
    },
    curveRecordId: toTrimmedString(curve.id),
    machine: {
      model: toTrimmedString(machine.model_key) || toTrimmedString(machine.display_name),
      notes: JSON.stringify(machine.configuration ?? {}),
    },
    machineId,
    plan: {
      batchWeightGrams: toFiniteNumber(plan.batch_weight_grams),
      name: toTrimmedString(plan.name) || toTrimmedString(batch.roast_plan_name),
      roasterModel: toTrimmedString(machine.display_name) || toTrimmedString(machine.model_key),
      steps: planSteps,
    },
    roast: {
      developmentRatio: toFiniteNumber(batch.development_ratio) ?? getFirstNumber(metrics, metricFieldAliases.developmentRatio),
      dropTemperatureC: getFirstNumber(metrics, metricFieldAliases.dropTemperature),
      firstCrackTimeSeconds: toFiniteNumber(batch.first_crack_time) ?? getFirstNumber(metrics, metricFieldAliases.firstCrackTime),
      target: toTrimmedString(batch.roast_level) || '未填写目标',
      totalTimeSeconds,
    },
    roastBatchId,
    signals: {
      chargeTemperatureC: getFirstNumber(metrics, metricFieldAliases.chargeTemperature) ?? '',
      curvePointCount: points.length,
      developmentTimeSeconds: getFirstNumber(metrics, metricFieldAliases.developmentTime) ?? '',
      dryEndTemperatureC: getFirstNumber(metrics, metricFieldAliases.dryEndTemperature) ?? '',
      dryEndTimeSeconds: getFirstNumber(metrics, metricFieldAliases.dryEndTime) ?? '',
      dropTemperatureC: getFirstNumber(metrics, metricFieldAliases.dropTemperature) ?? '',
      firstCrackTemperatureC: getFirstNumber(metrics, metricFieldAliases.firstCrackTemperature) ?? '',
      inputWeightGrams: inputWeight ?? '',
      outputWeightGrams: outputWeight ?? '',
      planBatchWeightGrams: toFiniteNumber(plan.batch_weight_grams) ?? '',
      turningPointTemperatureC: getFirstNumber(metrics, metricFieldAliases.turningPointTemperature) ?? '',
      turningPointTimeSeconds: getFirstNumber(metrics, metricFieldAliases.turningPointTime) ?? '',
      weightLossPercent: weightLossPercent ?? '',
    },
  };
};

const resolveRoastAnalysisInput = async (
  token: string,
  payload: unknown,
): Promise<RoastAnalysisRequest> => {
  if (!isRecord(payload)) {
    throw new Error('烘焙 AI 请求参数无效。');
  }

  if (isRecord(payload.machine) && isRecord(payload.roast)) {
    return parseRoastAnalysisPayload(payload);
  }

  const roastBatchId = toTrimmedString(payload.roastBatchId);

  if (!roastBatchId) {
    throw new Error('缺少烘焙记录 ID。');
  }

  return buildRoastAnalysisRequestFromPocketBase(token, roastBatchId);
};

const readRoastAnalysisCurveReadiness = async (
  token: string,
  roastBatchId: string,
): Promise<Record<string, number | string | boolean>> => {
  const batch = await getRecordById(token, ROAST_BATCHES_COLLECTION, roastBatchId);
  const curve = await getCurveByBatchId(token, roastBatchId);
  const points = curve ? getArray(curve.curve_data) : [];
  const metrics = curve && isRecord(curve.metrics) ? curve.metrics : {};
  const totalTimeSeconds = batch && curve ? getRoastDuration(batch, curve, metrics, points) : 0;
  const curveRecordId = curve ? toTrimmedString(curve.id) : '';

  return {
    curvePointCount: points.length,
    curveRecordId,
    hasCurve: curveRecordId.length > 0 && points.length > 0 && totalTimeSeconds > 0,
    totalTimeSeconds,
  };
};

export const handleRoastAnalysis = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const session = await refreshAuthenticatedSession(request, response);

  if (!session) {
    return;
  }

  let input: RoastAnalysisRequest;

  try {
    input = await resolveRoastAnalysisInput(
      session.token,
      await parseLimitedJsonBody(request, { maxBytes: MAX_ANALYSIS_REQUEST_BYTES }),
    );
  } catch (error) {
    if (error instanceof RoastAnalysisReadinessError) {
      sendApiError(response, error.status, error.message);
      return;
    }

    if (error instanceof PocketBaseGatewayError) {
      sendApiError(response, error.status, normalizeErrorPayload(error.payload).message ?? 'AI 复盘数据读取失败。');
      return;
    }

    sendApiError(response, 400, error instanceof Error ? error.message : '烘焙 AI 请求参数无效。');
    return;
  }

  let usageContext: RoastAiUsageContext | null = null;

  try {
    const existingPayload = await listPocketBaseRecords(session.token, AI_ROAST_REVIEWS_COLLECTION, {
      fields: '*',
      filter: `owner = ${escapeFilterValue(session.record.id)} && roast_batch_id = ${escapeFilterValue(input.roastBatchId)}`,
      perPage: 1,
    });
    const existing = getFirstListItem(existingPayload);

    if (existing && isRecord(existing.analysis_result)) {
      sendApiSuccess(response, {
        alreadyReviewed: true,
        analysis: existing.analysis_result,
        model: getGenerationModel(existing),
        reviewId: toTrimmedString(existing.id),
      });
      return;
    }

    usageContext = await readRoastAiUsageContext(session.record.id, AI_FEATURE_ROAST_ANALYSIS);
    ensureRoastAiUsageAvailable(usageContext);

    const analysis = await requestRoastAnalysis(input);

    const created = await proxyPocketBaseRequest(`/api/collections/${AI_ROAST_REVIEWS_COLLECTION}/records`, {
      body: JSON.stringify({
        analysis_result: analysis,
        curve_record_id: input.curveRecordId,
        generation_meta: { generatedAt: new Date().toISOString(), model: process.env.AI_ROAST_MODEL?.trim() ?? '' },
        input_snapshot: input,
        machine_id: input.machineId,
        owner: session.record.id,
        roast_batch_id: input.roastBatchId,
      }),
      headers: { Accept: 'application/json', Authorization: session.token, 'Content-Type': 'application/json' },
      method: 'POST',
    });

    if (!created.response.ok) {
      throw new PocketBaseGatewayError(created.response.status, created.payload);
    }

    const usage = await createSuccessfulRoastAiUsage(usageContext);

    sendApiSuccess(response, {
      alreadyReviewed: false,
      analysis,
      model: process.env.AI_ROAST_MODEL?.trim() ?? '',
      reviewId: isRecord(created.payload) ? toTrimmedString(created.payload.id) : undefined,
      usage,
    });
  } catch (error) {
    if (usageContext) {
      const message = error instanceof Error ? error.message : '烘焙 AI 分析失败。';
      await logRoastAiUsageFailure(usageContext, message);
    }

    if (error instanceof PocketBaseGatewayError) {
      sendApiError(response, error.status, normalizeErrorPayload(error.payload).message ?? 'AI 复盘保存失败。');
      return;
    }
    sendApiError(response, 502, error instanceof Error ? error.message : '烘焙 AI 分析失败。');
  }
};

export const handleRoastAnalysisStatus = async (request: IncomingMessage, response: ServerResponse, requestUrl: URL): Promise<void> => {
  const session = await refreshAuthenticatedSession(request, response);
  if (!session) return;
  const roastBatchId = toTrimmedString(requestUrl.searchParams.get('roastBatchId'));
  if (!roastBatchId) {
    sendApiError(response, 400, '缺少烘焙记录 ID。');
    return;
  }
  try {
    const payload = await listPocketBaseRecords(session.token, AI_ROAST_REVIEWS_COLLECTION, {
      fields: '*',
      filter: `owner = ${escapeFilterValue(session.record.id)} && roast_batch_id = ${escapeFilterValue(roastBatchId)}`,
      perPage: 1,
    });
    const review = getFirstListItem(payload);
    const readiness = await readRoastAnalysisCurveReadiness(session.token, roastBatchId);
    sendApiSuccess(response, {
      analysis: review && isRecord(review.analysis_result) ? review.analysis_result : null,
      model: review ? getGenerationModel(review) : '',
      readiness,
      reviewed: review != null,
      reviewId: review ? toTrimmedString(review.id) : undefined,
    });
  } catch (error) {
    sendApiError(response, 502, error instanceof Error ? error.message : 'AI 复盘状态读取失败。');
  }
};
