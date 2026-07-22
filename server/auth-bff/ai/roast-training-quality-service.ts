import { normalizeErrorPayload, proxyPocketBaseRequest } from '../pocketbase-client.js';
import { escapeFilterValue, listPocketBaseRecords } from '../record-utils.js';
import { PocketBaseGatewayError } from '../types.js';
import { isRecord, toTrimmedString } from '../utils.js';

export const TRAINING_SAMPLES_COLLECTION = 'roast_training_samples';

export interface RoastTrainingQualityReport {
  checkedAt: string;
  errors: string[];
  metrics: {
    curvePointCount: number;
    developmentRatio?: number;
    totalRoastTimeSeconds?: number;
    validBeanTemperatureCount: number;
    weightLossPercent?: number;
  };
  passed: boolean;
  warnings: string[];
}

export interface RoastTrainingQualityCheckResult {
  checkedAt: string;
  report: RoastTrainingQualityReport;
  status: 'failed' | 'passed';
}

const MIN_CURVE_POINTS = 50;
const MIN_REASONABLE_SECONDS = 4 * 60;
const MAX_REASONABLE_SECONDS = 25 * 60;

const getObject = (value: unknown): Record<string, unknown> | null => {
  return isRecord(value) ? value : null;
};

const getArray = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

const getNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const hasText = (value: unknown): boolean => {
  return typeof value === 'string' && value.trim().length > 0;
};

const parseStepTimeSeconds = (step: Record<string, unknown>): number | undefined => {
  const directValue = getNumber(step.timeSeconds) ?? getNumber(step.time_seconds);

  if (directValue != null) {
    return directValue;
  }

  const timeLabel = toTrimmedString(step.timeLabel ?? step.time_label);
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeLabel);

  if (!match) {
    return undefined;
  }

  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
};

const isNonDecreasing = (values: number[]): boolean => {
  return values.every((value, index) => index === 0 || value >= (values[index - 1] ?? value));
};

const getCurveDuration = (
  curvePoints: unknown[],
  metrics: Record<string, unknown>,
): number | undefined => {
  const metricDuration =
    getNumber(metrics.roastDuration) ??
    getNumber(metrics.roast_duration) ??
    getNumber(metrics.dropTime) ??
    getNumber(metrics.drop_time);

  if (metricDuration != null) {
    return metricDuration;
  }

  const lastPoint = getObject(curvePoints[curvePoints.length - 1]);
  return lastPoint ? getNumber(lastPoint.timeSeconds ?? lastPoint.time_seconds) : undefined;
};

export const evaluateRoastTrainingSampleQuality = (
  sample: Record<string, unknown>,
  checkedAt = new Date().toISOString(),
): RoastTrainingQualityCheckResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const snapshot = getObject(sample.snapshot);
  const roastBatch = getObject(snapshot?.roastBatch);
  const roastCurve = getObject(snapshot?.roastCurve);
  const greenBean = getObject(snapshot?.greenBean);
  const roastPlan = getObject(snapshot?.roastPlan);

  if (!snapshot) errors.push('缺少训练快照。');
  if (!roastBatch) errors.push('缺少烘焙记录快照。');
  if (!roastCurve) errors.push('缺少曲线快照。');
  if (!greenBean) errors.push('缺少生豆快照。');
  if (!roastPlan) errors.push('缺少烘焙计划快照。');

  const evaluation = getObject(roastBatch?.evaluation);
  const overallScore = getNumber(evaluation?.overallScore);
  const targetMatchScore = getNumber(evaluation?.targetMatchScore);

  if (evaluation?.allowTraining !== true) {
    errors.push('训练授权未开启。');
  }

  if (overallScore == null || overallScore < 1 || overallScore > 5) {
    errors.push('综合评分缺失或超出 1-5 范围。');
  }

  if (targetMatchScore == null || targetMatchScore < 1 || targetMatchScore > 5) {
    errors.push('目标达成度缺失或超出 1-5 范围。');
  }

  if (
    !hasText(evaluation?.flavorNotes) &&
    !hasText(evaluation?.defectNotes) &&
    !hasText(evaluation?.nextAdjustmentNotes)
  ) {
    errors.push('评价表单缺少复盘文本。');
  }

  const curvePoints = getArray(roastCurve?.curve_data);
  const metrics = getObject(roastCurve?.metrics) ?? {};
  const pointTimes = curvePoints
    .map((point) => getObject(point))
    .map((point) => (point ? getNumber(point.timeSeconds ?? point.time_seconds) : undefined))
    .filter((value): value is number => value != null);
  const beanTemperatures = curvePoints
    .map((point) => getObject(point))
    .map((point) => (point ? getNumber(point.beanTemperature ?? point.bean_temperature) : undefined))
    .filter((value): value is number => value != null);
  const curveDuration = getCurveDuration(curvePoints, metrics);
  const developmentRatio = getNumber(metrics.developmentRatio ?? metrics.development_ratio);

  if (curvePoints.length < MIN_CURVE_POINTS) {
    errors.push(`曲线点数量不足，至少需要 ${String(MIN_CURVE_POINTS)} 个点。`);
  }

  if (pointTimes.length < Math.min(curvePoints.length, MIN_CURVE_POINTS)) {
    errors.push('曲线时间字段缺失过多。');
  } else if (!isNonDecreasing(pointTimes)) {
    errors.push('曲线时间不是递增序列。');
  }

  if (beanTemperatures.length === 0) {
    errors.push('曲线缺少豆温数据。');
  }

  if (beanTemperatures.some((value) => value < 20 || value > 300)) {
    warnings.push('曲线豆温存在超出 20-300°C 的异常点，建议人工复核。');
  }

  if (curveDuration == null) {
    errors.push('曲线缺少总时长。');
  } else if (curveDuration < MIN_REASONABLE_SECONDS || curveDuration > MAX_REASONABLE_SECONDS) {
    warnings.push('烘焙总时长超出 4-25 分钟常见范围，建议人工复核。');
  }

  const inputWeight = getNumber(roastBatch?.input_weight_grams);
  const outputWeight = getNumber(roastBatch?.output_weight_grams);
  const weightLossPercent =
    inputWeight != null && outputWeight != null && inputWeight > 0
      ? ((inputWeight - outputWeight) / inputWeight) * 100
      : undefined;

  if (inputWeight == null || inputWeight <= 0) {
    errors.push('入豆量缺失或小于等于 0。');
  }

  if (outputWeight == null || outputWeight <= 0) {
    errors.push('出豆量缺失或小于等于 0。');
  }

  if (inputWeight != null && outputWeight != null && outputWeight > inputWeight) {
    errors.push('出豆量不能大于入豆量。');
  }

  if (weightLossPercent != null && (weightLossPercent < 5 || weightLossPercent > 25)) {
    warnings.push('失水率超出 5%-25% 常见范围，建议人工复核。');
  }

  if (developmentRatio != null && (developmentRatio < 5 || developmentRatio > 35)) {
    warnings.push('发展比超出 5%-35% 常见范围，建议人工复核。');
  }

  const steps = getArray(roastPlan?.steps);
  const stepTimes = steps
    .map((step) => getObject(step))
    .map((step) => (step ? parseStepTimeSeconds(step) : undefined))
    .filter((value): value is number => value != null);

  if (steps.length === 0) {
    errors.push('烘焙计划缺少节点。');
  } else if (stepTimes.length >= 2 && !isNonDecreasing(stepTimes)) {
    errors.push('烘焙计划节点时间不是递增序列。');
  }

  if (!hasText(sample.roaster_model)) {
    errors.push('训练样本缺少烘焙机信息。');
  }

  const report: RoastTrainingQualityReport = {
    checkedAt,
    errors,
    metrics: {
      curvePointCount: curvePoints.length,
      developmentRatio,
      totalRoastTimeSeconds: curveDuration,
      validBeanTemperatureCount: beanTemperatures.length,
      weightLossPercent: weightLossPercent == null ? undefined : Number(weightLossPercent.toFixed(1)),
    },
    passed: errors.length === 0,
    warnings,
  };

  return {
    checkedAt,
    report,
    status: report.passed ? 'passed' : 'failed',
  };
};

export const updateRoastTrainingSampleQuality = async (
  token: string,
  sampleId: string,
  result: RoastTrainingQualityCheckResult,
): Promise<void> => {
  const upstream = await proxyPocketBaseRequest(`/api/collections/${TRAINING_SAMPLES_COLLECTION}/records/${sampleId}`, {
    body: JSON.stringify({
      quality_checked_at: result.checkedAt,
      quality_report: result.report,
      quality_status: result.status,
    }),
    headers: {
      Accept: 'application/json',
      Authorization: token,
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  });

  if (!upstream.response.ok) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }
};

export const checkAndUpdateRoastTrainingSampleQuality = async (
  token: string,
  sample: Record<string, unknown>,
): Promise<RoastTrainingQualityCheckResult> => {
  const sampleId = toTrimmedString(sample.id);

  if (!sampleId) {
    throw new PocketBaseGatewayError(502, {
      message: '训练样本缺少 ID，无法写入质量检查结果。',
    });
  }

  const result = evaluateRoastTrainingSampleQuality(sample);
  await updateRoastTrainingSampleQuality(token, sampleId, result);
  return result;
};

export const listPendingRoastTrainingSamples = async (
  token: string,
): Promise<Record<string, unknown>[]> => {
  const payload = await listPocketBaseRecords(token, TRAINING_SAMPLES_COLLECTION, {
    fields: '*',
    filter: `quality_status = ${escapeFilterValue('pending')}`,
    perPage: 200,
  });

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new PocketBaseGatewayError(502, {
      message: '训练样本列表响应缺少必要字段。',
    });
  }

  return payload.items.filter(isRecord);
};

export const getPocketBaseGatewayMessage = (error: PocketBaseGatewayError, fallback: string): string => {
  return normalizeErrorPayload(error.payload).message ?? fallback;
};
