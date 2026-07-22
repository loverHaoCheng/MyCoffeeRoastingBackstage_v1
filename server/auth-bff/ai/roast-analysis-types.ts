import type { IncomingMessage } from 'node:http';

import { parseLimitedJsonBody } from '../http.js';
import { isRecord, toTrimmedString } from '../utils.js';

const MAX_CONTEXT_ENTRIES = 24;
const MAX_CURVE_SAMPLES = 16;
const MAX_PLAN_STEPS = 16;
const MAX_TEXT_LENGTH = 500;
const MAX_REQUEST_BYTES = 48 * 1024;

export interface RoastAnalysisBatchContext {
  evaluationSummary?: string;
  inputWeightGrams: null | number;
  notes?: string;
  outputWeightGrams: null | number;
  weightLossPercent: null | number;
}

export interface RoastAnalysisPlanStepContext {
  airTemperature?: string;
  drumSpeed?: string;
  drumTemperature?: string;
  eventName: string;
  firePower?: string;
  note?: string;
  operation?: string;
  timeLabel: string;
}

export interface RoastAnalysisPlanContext {
  batchWeightGrams: null | number;
  name: string;
  roasterModel: string;
  steps: RoastAnalysisPlanStepContext[];
}

export interface RoastAnalysisCurveSample {
  beanTemperature?: number;
  drumSpeed?: number;
  environmentTemperature?: number;
  fanSpeed?: number;
  heatPower?: number;
  rateOfRise?: number;
  timeSeconds: number;
}

export interface RoastAnalysisRequest {
  batch?: RoastAnalysisBatchContext;
  curve?: {
    controlStats: Record<string, Record<string, null | number>>;
    rorStats: Record<string, null | number>;
    samples: RoastAnalysisCurveSample[];
  };
  curveRecordId: string;
  machineId: string;
  roastBatchId: string;
  machine: {
    model: string;
    notes: string;
  };
  plan?: RoastAnalysisPlanContext;
  roast: {
    developmentRatio: null | number;
    dropTemperatureC: null | number;
    firstCrackTimeSeconds: null | number;
    target: string;
    totalTimeSeconds: number;
  };
  signals: Record<string, number | string>;
}

export interface RoastAnalysisIssue {
  category: string;
  evidence: string;
  severity: 'high' | 'low' | 'medium';
}

export interface RoastAnalysisPrimaryAdjustment {
  action: string;
  area: 'development' | 'energy' | 'insufficient_data' | 'ror';
  direction: 'decrease' | 'increase' | 'maintain' | 'observe';
  rationale: string;
}

export interface RoastAnalysisResult {
  confidence: number;
  issues: RoastAnalysisIssue[];
  nextRoastAdjustments: string[];
  primaryAdjustment: RoastAnalysisPrimaryAdjustment;
  summary: string;
}

const toOptionalFiniteNumber = (value: unknown): null | number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const toLimitedText = (value: unknown, fieldName: string, required = false): string => {
  const text = toTrimmedString(value);

  if (required && !text) {
    throw new Error(`${fieldName}不能为空。`);
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`${fieldName}不能超过 ${String(MAX_TEXT_LENGTH)} 个字符。`);
  }

  return text;
};

const parseSignals = (value: unknown): Record<string, number | string> => {
  if (value == null) {
    return {};
  }

  if (!isRecord(value)) {
    throw new Error('曲线指标必须是对象。');
  }

  const signals: Record<string, number | string> = {};

  for (const [key, item] of Object.entries(value)) {
    if (Object.keys(signals).length >= MAX_CONTEXT_ENTRIES) {
      break;
    }

    if (typeof item === 'string') {
      signals[toLimitedText(key, '曲线指标名称', true)] = toLimitedText(item, '曲线指标文本');
      continue;
    }

    if (typeof item === 'number' && Number.isFinite(item)) {
      signals[toLimitedText(key, '曲线指标名称', true)] = item;
    }
  }

  return signals;
};

const parseMetricSet = (value: unknown): Record<string, null | number> => {
  if (!isRecord(value)) {
    return {};
  }

  const metrics: Record<string, null | number> = {};

  for (const [key, item] of Object.entries(value)) {
    if (Object.keys(metrics).length >= MAX_CONTEXT_ENTRIES) {
      break;
    }

    const metricName = toLimitedText(key, '指标名称', true);
    metrics[metricName] = item == null ? null : toOptionalFiniteNumber(item);
  }

  return metrics;
};

const parseControlStats = (value: unknown): Record<string, Record<string, null | number>> => {
  if (!isRecord(value)) {
    return {};
  }

  const stats: Record<string, Record<string, null | number>> = {};

  for (const [key, item] of Object.entries(value)) {
    if (Object.keys(stats).length >= MAX_CONTEXT_ENTRIES) {
      break;
    }

    stats[toLimitedText(key, '控制指标名称', true)] = parseMetricSet(item);
  }

  return stats;
};

const parseBatchContext = (value: unknown): RoastAnalysisBatchContext | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const evaluationSummary = toLimitedText(value.evaluationSummary, '评价摘要');
  const notes = toLimitedText(value.notes, '烘焙备注');

  return {
    ...(evaluationSummary ? { evaluationSummary } : {}),
    inputWeightGrams: toOptionalFiniteNumber(value.inputWeightGrams),
    ...(notes ? { notes } : {}),
    outputWeightGrams: toOptionalFiniteNumber(value.outputWeightGrams),
    weightLossPercent: toOptionalFiniteNumber(value.weightLossPercent),
  };
};

const parsePlanSteps = (value: unknown): RoastAnalysisPlanStepContext[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((step) => ({
      airTemperature: toLimitedText(step.airTemperature, '节点风温'),
      drumSpeed: toLimitedText(step.drumSpeed, '节点转速'),
      drumTemperature: toLimitedText(step.drumTemperature, '节点炉温'),
      eventName: toLimitedText(step.eventName, '节点名称', true),
      firePower: toLimitedText(step.firePower, '节点火力'),
      note: toLimitedText(step.note, '节点备注'),
      operation: toLimitedText(step.operation, '节点操作'),
      timeLabel: toLimitedText(step.timeLabel, '节点时间', true),
    }))
    .filter((step) => step.eventName.length > 0 && step.timeLabel.length > 0)
    .slice(0, MAX_PLAN_STEPS);
};

const parsePlanContext = (value: unknown): RoastAnalysisPlanContext | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = toLimitedText(value.name, '烘焙计划名称');
  const roasterModel = toLimitedText(value.roasterModel, '计划烘焙机型号');

  return {
    batchWeightGrams: toOptionalFiniteNumber(value.batchWeightGrams),
    name,
    roasterModel,
    steps: parsePlanSteps(value.steps),
  };
};

const parseCurveSamples = (value: unknown): RoastAnalysisCurveSample[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((sample) => {
      const timeSeconds = toOptionalFiniteNumber(sample.timeSeconds);
      const beanTemperature = toOptionalFiniteNumber(sample.beanTemperature);
      const drumSpeed = toOptionalFiniteNumber(sample.drumSpeed);
      const environmentTemperature = toOptionalFiniteNumber(sample.environmentTemperature);
      const fanSpeed = toOptionalFiniteNumber(sample.fanSpeed);
      const heatPower = toOptionalFiniteNumber(sample.heatPower);
      const rateOfRise = toOptionalFiniteNumber(sample.rateOfRise);

      if (timeSeconds == null) {
        return null;
      }

      return {
        ...(beanTemperature != null ? { beanTemperature } : {}),
        ...(drumSpeed != null ? { drumSpeed } : {}),
        ...(environmentTemperature != null ? { environmentTemperature } : {}),
        ...(fanSpeed != null ? { fanSpeed } : {}),
        ...(heatPower != null ? { heatPower } : {}),
        ...(rateOfRise != null ? { rateOfRise } : {}),
        timeSeconds,
      };
    })
    .filter((sample): sample is RoastAnalysisCurveSample => sample != null)
    .slice(0, MAX_CURVE_SAMPLES);
};

const parseCurveContext = (value: unknown): RoastAnalysisRequest['curve'] | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    controlStats: parseControlStats(value.controlStats),
    rorStats: parseMetricSet(value.rorStats),
    samples: parseCurveSamples(value.samples),
  };
};

export const parseRoastAnalysisRequest = async (request: IncomingMessage): Promise<RoastAnalysisRequest> => {
  const body = await parseLimitedJsonBody(request, { maxBytes: MAX_REQUEST_BYTES });

  if (!isRecord(body) || !isRecord(body.machine) || !isRecord(body.roast)) {
    throw new Error('烘焙 AI 请求缺少 machine 或 roast 参数。');
  }

  const totalTimeSeconds = toOptionalFiniteNumber(body.roast.totalTimeSeconds);

  if (totalTimeSeconds == null || totalTimeSeconds <= 0) {
    throw new Error('总烘焙时长必须是大于 0 的数值。');
  }

  const batch = parseBatchContext(body.batch);
  const curve = parseCurveContext(body.curve);
  const plan = parsePlanContext(body.plan);

  return {
    ...(batch ? { batch } : {}),
    ...(curve ? { curve } : {}),
    curveRecordId: toLimitedText(body.curveRecordId, '曲线记录 ID', true),
    machineId: toLimitedText(body.machineId, '烘焙机 ID', true),
    roastBatchId: toLimitedText(body.roastBatchId, '烘焙记录 ID', true),
    machine: {
      model: toLimitedText(body.machine.model, '烘焙机型号', true),
      notes: toLimitedText(body.machine.notes, '机器备注'),
    },
    ...(plan ? { plan } : {}),
    roast: {
      developmentRatio: toOptionalFiniteNumber(body.roast.developmentRatio),
      dropTemperatureC: toOptionalFiniteNumber(body.roast.dropTemperatureC),
      firstCrackTimeSeconds: toOptionalFiniteNumber(body.roast.firstCrackTimeSeconds),
      target: toLimitedText(body.roast.target, '烘焙目标', true),
      totalTimeSeconds,
    },
    signals: parseSignals(body.signals),
  };
};

const toSeverity = (value: unknown): RoastAnalysisIssue['severity'] => {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
};

const toPrimaryArea = (value: unknown): RoastAnalysisPrimaryAdjustment['area'] | null => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (normalized === 'development' || normalized === '发展' || normalized === '发展期') {
    return 'development';
  }

  if (normalized === 'energy' || normalized === '能量' || normalized === '火力') {
    return 'energy';
  }

  if (normalized === 'ror' || normalized === 'rate of rise' || normalized === '升温率') {
    return 'ror';
  }

  return normalized === 'insufficient_data' || normalized === '数据不足' ? 'insufficient_data' : null;
};

const toPrimaryDirection = (value: unknown): RoastAnalysisPrimaryAdjustment['direction'] | null => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (normalized === 'decrease' || normalized === '减少' || normalized === '降低' || normalized === '缩短') {
    return 'decrease';
  }

  if (normalized === 'increase' || normalized === '增加' || normalized === '提高' || normalized === '延长') {
    return 'increase';
  }

  if (normalized === 'maintain' || normalized === '保持' || normalized === '维持') {
    return 'maintain';
  }

  return normalized === 'observe' || normalized === '观察' ? 'observe' : null;
};

const issueCategoryLabels: Record<string, string> = {
  data_integrity: '曲线记录',
  development: '发展期',
  drop_temperature: '出炉温度',
  droptemperature: '出炉温度',
  drying: '干燥期',
  energy: '能量供应',
  ror: '升温率',
  ror_consistency: '升温率记录',
};

const toHumanIssueCategory = (value: unknown): string => {
  const text = toTrimmedString(value);
  const normalized = text.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');

  return issueCategoryLabels[normalized] ?? text;
};

const humanReadableTextReplacements: [RegExp, string][] = [
  [/\bdata_integrity\b/gi, '曲线记录'],
  [/\bror_consistency\b/gi, '升温率记录'],
  [/\broast\.totalTimeSeconds\b/g, '总烘焙时长'],
  [/\bcurve\.samples\b/g, '曲线采样点'],
  [/\bsignals\.dropTemperatureC\b/g, '下豆温度记录'],
  [/\bsignals\b/g, '曲线摘要'],
  [/\brorStats\.averagePositive\b/g, '平均正向升温率'],
  [/\brorStats\.firstCrack\b/g, '一爆时升温率'],
  [/\brorStats\.drop\b/g, '下豆时升温率'],
  [/\brorStats\.end\b/g, '末段升温率'],
  [/\brorStats\b/g, '升温率统计'],
  [/\btimeSeconds\b/g, '时间点'],
  [/\bbeanTemperature\b/g, '豆温'],
  [/\brateOfRise\b/g, '升温率'],
  [/\bRoR\b/g, '升温率'],
  [/\bROR\b/g, '升温率'],
  [/\bend ROR\b/gi, '末段升温率'],
  [/\bend RoR\b/gi, '末段升温率'],
  [/\bend\b/g, '末段'],
  [/\bdrop\b/g, '下豆'],
  [/末段\s+升温率/g, '末段升温率'],
  [/升温率\s+末段/g, '末段升温率'],
];

const toHumanReadableRoastText = (value: unknown): string => {
  return humanReadableTextReplacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), toTrimmedString(value));
};

export const normalizeRoastAnalysisResult = (value: unknown): RoastAnalysisResult | null => {
  if (!isRecord(value)) {
    return null;
  }

  const summary = toHumanReadableRoastText(value.summary);
  const primaryAdjustmentValue = value.primaryAdjustment ?? value.primary_adjustment ?? value.mainAdjustment;
  const primaryAdjustment = isRecord(primaryAdjustmentValue)
    ? {
        action: toHumanReadableRoastText(primaryAdjustmentValue.action ?? primaryAdjustmentValue.adjustment ?? primaryAdjustmentValue.recommendation),
        area: toPrimaryArea(primaryAdjustmentValue.area),
        direction: toPrimaryDirection(primaryAdjustmentValue.direction),
        rationale: toHumanReadableRoastText(primaryAdjustmentValue.rationale ?? primaryAdjustmentValue.reason ?? primaryAdjustmentValue.evidence),
      }
    : null;

  if (!summary || !primaryAdjustment) {
    return null;
  }

  if (!primaryAdjustment.area || !primaryAdjustment.direction || !primaryAdjustment.action || !primaryAdjustment.rationale) {
    return null;
  }

  const issues = Array.isArray(value.issues)
    ? value.issues
        .filter(isRecord)
        .map((issue) => ({
          category: toHumanIssueCategory(issue.category),
          evidence: toHumanReadableRoastText(issue.evidence),
          severity: toSeverity(issue.severity),
        }))
        .filter((issue) => issue.category.length > 0 && issue.evidence.length > 0)
        .slice(0, 6)
    : [];
  const nextRoastAdjustments = Array.isArray(value.nextRoastAdjustments)
    ? value.nextRoastAdjustments
        .map((item) => toHumanReadableRoastText(item))
        .filter((item) => item.length > 0)
        .slice(0, 6)
    : [];
  const confidenceCandidate = toOptionalFiniteNumber(value.confidence);

  return {
    confidence: Math.round(Math.min(100, Math.max(0, confidenceCandidate ?? 0))),
    issues,
    nextRoastAdjustments,
    primaryAdjustment: {
      action: primaryAdjustment.action,
      area: primaryAdjustment.area,
      direction: primaryAdjustment.direction,
      rationale: primaryAdjustment.rationale,
    },
    summary,
  };
};
