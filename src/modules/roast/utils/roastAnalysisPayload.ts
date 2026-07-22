import type { RoastAnalysisRequest } from '@/modules/roast/services/roastAnalysis.service';
import type { RoastBatchEvaluation, RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { RoastCurvePoint, RoastCurveRecord } from '@/modules/roast/types/roastCurve';
import type { RoastingMachine } from '@/modules/roast/types/roasterMachine';
import type { RoastPlan, RoastPlanStep } from '@/types/domain';

const MAX_CURVE_SAMPLES = 12;
const MAX_PLAN_STEPS = 16;

const roundMetric = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const toFiniteNumber = (value: unknown): null | number => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const average = (values: number[]): null | number => {
  if (values.length === 0) {
    return null;
  }

  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const getNearestPointValue = (points: RoastCurvePoint[], timeSeconds?: number, field: keyof RoastCurvePoint = 'rateOfRise'): null | number => {
  if (typeof timeSeconds !== 'number' || !Number.isFinite(timeSeconds) || points.length === 0) {
    return null;
  }

  const nearest = points.reduce<RoastCurvePoint | null>((currentNearest, point) => {
    if (!currentNearest) {
      return point;
    }

    return Math.abs(point.timeSeconds - timeSeconds) < Math.abs(currentNearest.timeSeconds - timeSeconds) ? point : currentNearest;
  }, null);

  return roundNullable(toFiniteNumber(nearest?.[field]));
};

const roundNullable = (value: null | number): null | number => (value == null ? null : roundMetric(value));

const summarizeSeries = (values: number[]): Record<string, null | number> => {
  const firstValue = values[0];

  if (firstValue == null) {
    return { average: null, end: null, max: null, min: null };
  }

  const lastValue = values[values.length - 1] ?? firstValue;

  return {
    average: average(values),
    end: roundMetric(lastValue),
    max: roundMetric(Math.max(...values)),
    min: roundMetric(Math.min(...values)),
  };
};

const collectFieldValues = (points: RoastCurvePoint[], field: keyof RoastCurvePoint): number[] => {
  return points.map((point) => toFiniteNumber(point[field])).filter((value): value is number => value != null);
};

const summarizeRor = (curve: RoastCurveRecord): Record<string, null | number> => {
  const positiveValues = collectFieldValues(curve.curveData, 'rateOfRise').filter((value) => value > 0);
  const firstPositiveValue = positiveValues[0];
  const lastPositiveValue = firstPositiveValue == null ? null : positiveValues[positiveValues.length - 1] ?? firstPositiveValue;

  return {
    averagePositive: average(positiveValues),
    drop: getNearestPointValue(curve.curveData, curve.metrics.dropTime),
    end: lastPositiveValue == null ? null : roundMetric(lastPositiveValue),
    firstCrack: getNearestPointValue(curve.curveData, curve.metrics.firstCrackTime),
    maxPositive: positiveValues.length > 0 ? roundMetric(Math.max(...positiveValues)) : null,
    minPositive: positiveValues.length > 0 ? roundMetric(Math.min(...positiveValues)) : null,
  };
};

type RoastAnalysisCurveContext = NonNullable<RoastAnalysisRequest['curve']>;
type RoastAnalysisPlanContext = NonNullable<RoastAnalysisRequest['plan']>;

const pickCurveSamples = (points: RoastCurvePoint[]): RoastAnalysisCurveContext['samples'] => {
  if (points.length <= MAX_CURVE_SAMPLES) {
    return points.map(toCurveSample).filter((sample): sample is RoastAnalysisCurveContext['samples'][number] => Boolean(sample));
  }

  const lastIndex = points.length - 1;
  const indexes = Array.from({ length: MAX_CURVE_SAMPLES }, (_, index) => Math.round((index * lastIndex) / (MAX_CURVE_SAMPLES - 1)));
  const uniqueIndexes = [...new Set(indexes)];

  return uniqueIndexes.map((index) => toCurveSample(points[index])).filter((sample): sample is RoastAnalysisCurveContext['samples'][number] => Boolean(sample));
};

const toCurveSample = (point: RoastCurvePoint | undefined): RoastAnalysisCurveContext['samples'][number] | null => {
  if (!point) {
    return null;
  }

  const beanTemperature = toFiniteNumber(point.beanTemperature);
  const drumSpeed = toFiniteNumber(point.drumSpeed);
  const environmentTemperature = toFiniteNumber(point.environmentTemperature);
  const fanSpeed = toFiniteNumber(point.fanSpeed);
  const heatPower = toFiniteNumber(point.heatPower);
  const rateOfRise = toFiniteNumber(point.rateOfRise);

  return {
    ...(beanTemperature != null ? { beanTemperature: roundMetric(beanTemperature) } : {}),
    ...(drumSpeed != null ? { drumSpeed: roundMetric(drumSpeed) } : {}),
    ...(environmentTemperature != null ? { environmentTemperature: roundMetric(environmentTemperature) } : {}),
    ...(fanSpeed != null ? { fanSpeed: roundMetric(fanSpeed) } : {}),
    ...(heatPower != null ? { heatPower: roundMetric(heatPower) } : {}),
    ...(rateOfRise != null ? { rateOfRise: roundMetric(rateOfRise) } : {}),
    timeSeconds: roundMetric(point.timeSeconds),
  };
};

const summarizeEvaluation = (evaluation: RoastBatchEvaluation): string => {
  const parts = [
    typeof evaluation.overallScore === 'number' ? `整体评分 ${String(evaluation.overallScore)}` : '',
    typeof evaluation.targetMatchScore === 'number' ? `目标匹配 ${String(evaluation.targetMatchScore)}` : '',
    evaluation.flavorNotes ? `风味：${evaluation.flavorNotes}` : '',
    evaluation.defectNotes ? `缺陷：${evaluation.defectNotes}` : '',
    evaluation.nextAdjustmentNotes ? `下次调整：${evaluation.nextAdjustmentNotes}` : '',
  ].filter((part) => part.length > 0);

  return parts.join('；');
};

const mapPlanStep = (step: RoastPlanStep): RoastAnalysisPlanContext['steps'][number] => ({
  airTemperature: step.airTemperature,
  drumSpeed: step.drumSpeed,
  drumTemperature: step.drumTemperature,
  eventName: step.eventName,
  firePower: step.firePower,
  note: step.note,
  operation: step.operation,
  timeLabel: step.timeLabel,
});

export const buildRoastAnalysisRequest = (
  batch: RoastBatchRecord,
  curve: RoastCurveRecord,
  plan: RoastPlan,
  machine: RoastingMachine,
): RoastAnalysisRequest => {
  const inputWeight = toFiniteNumber(batch.inputWeightGrams);
  const outputWeight = toFiniteNumber(batch.outputWeightGrams);
  const weightLossPercent = inputWeight != null && inputWeight > 0 && outputWeight != null && outputWeight > 0
    ? roundMetric(((inputWeight - outputWeight) / inputWeight) * 100)
    : null;
  const evaluationSummary = summarizeEvaluation(batch.evaluation);

  return {
    batch: {
      evaluationSummary: evaluationSummary || undefined,
      inputWeightGrams: inputWeight,
      notes: batch.notes,
      outputWeightGrams: outputWeight,
      weightLossPercent,
    },
    curve: {
      controlStats: {
        drumSpeed: summarizeSeries(collectFieldValues(curve.curveData, 'drumSpeed')),
        environmentTemperature: summarizeSeries(collectFieldValues(curve.curveData, 'environmentTemperature')),
        fanSpeed: summarizeSeries(collectFieldValues(curve.curveData, 'fanSpeed')),
        heatPower: summarizeSeries(collectFieldValues(curve.curveData, 'heatPower')),
      },
      rorStats: summarizeRor(curve),
      samples: pickCurveSamples(curve.curveData),
    },
    curveRecordId: curve.id,
    machine: { model: machine.modelKey, notes: JSON.stringify(machine.configuration) },
    machineId: machine.id,
    plan: {
      batchWeightGrams: toFiniteNumber(plan.batchWeightGrams),
      name: plan.name,
      roasterModel: plan.roasterModel,
      steps: plan.steps.slice(0, MAX_PLAN_STEPS).map(mapPlanStep),
    },
    roast: {
      developmentRatio: batch.developmentRatio ?? curve.metrics.developmentRatio ?? null,
      dropTemperatureC: curve.metrics.dropTemperature ?? null,
      firstCrackTimeSeconds: batch.firstCrackTime ?? curve.metrics.firstCrackTime ?? null,
      target: batch.roastLevel,
      totalTimeSeconds: batch.totalRoastTime ?? curve.metrics.roastDuration ?? 0,
    },
    roastBatchId: batch.id,
    signals: {
      chargeTemperatureC: curve.metrics.chargeTemperature ?? '',
      curvePointCount: curve.curveData.length,
      developmentTimeSeconds: curve.metrics.developmentTime ?? '',
      dryEndTemperatureC: curve.metrics.dryEndTemperature ?? '',
      dryEndTimeSeconds: curve.metrics.dryEndTime ?? '',
      dropTemperatureC: curve.metrics.dropTemperature ?? '',
      firstCrackTemperatureC: curve.metrics.firstCrackTemperature ?? '',
      inputWeightGrams: inputWeight ?? '',
      outputWeightGrams: outputWeight ?? '',
      planBatchWeightGrams: plan.batchWeightGrams,
      turningPointTemperatureC: curve.metrics.turningPointTemperature ?? '',
      turningPointTimeSeconds: curve.metrics.turningPointTime ?? '',
      weightLossPercent: weightLossPercent ?? '',
    },
  };
};
