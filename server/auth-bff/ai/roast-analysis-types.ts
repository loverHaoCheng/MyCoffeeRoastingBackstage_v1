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

const toOptionalNonEmptyText = (value: string | undefined): string | undefined => {
  if (value == null || value.trim().length === 0) {
    return undefined;
  }

  return value;
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

export const parseRoastAnalysisPayload = (body: unknown): RoastAnalysisRequest => {
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

export const parseRoastAnalysisRequest = async (request: IncomingMessage): Promise<RoastAnalysisRequest> => {
  return parseRoastAnalysisPayload(await parseLimitedJsonBody(request, { maxBytes: MAX_REQUEST_BYTES }));
};

const toSeverity = (value: unknown): RoastAnalysisIssue['severity'] => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (normalized === 'high' || normalized === '高' || normalized === '严重' || normalized === '重点') {
    return 'high';
  }

  if (normalized === 'medium' || normalized === '中' || normalized === '中等' || normalized === '需要关注') {
    return 'medium';
  }

  return 'low';
};

const toPrimaryArea = (value: unknown): RoastAnalysisPrimaryAdjustment['area'] | null => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (normalized === 'development' || normalized === 'development_phase' || normalized === '发展' || normalized === '发展期') {
    return 'development';
  }

  if (normalized === 'energy' || normalized === 'heat' || normalized === 'fire' || normalized === '能量' || normalized === '火力' || normalized === '热量') {
    return 'energy';
  }

  if (normalized === 'ror' || normalized === 'rate_of_rise' || normalized === 'rate of rise' || normalized === '升温率') {
    return 'ror';
  }

  return normalized === 'insufficient_data' || normalized === '数据不足' ? 'insufficient_data' : null;
};

const toPrimaryDirection = (value: unknown): RoastAnalysisPrimaryAdjustment['direction'] | null => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (normalized === 'decrease' || normalized === 'reduce' || normalized === 'less' || normalized === '减少' || normalized === '降低' || normalized === '缩短' || normalized === '下调') {
    return 'decrease';
  }

  if (normalized === 'increase' || normalized === 'raise' || normalized === 'more' || normalized === '增加' || normalized === '提高' || normalized === '延长' || normalized === '上调') {
    return 'increase';
  }

  if (normalized === 'maintain' || normalized === 'keep' || normalized === '保持' || normalized === '维持') {
    return 'maintain';
  }

  return normalized === 'observe' || normalized === 'watch' || normalized === '观察' || normalized === '核对' ? 'observe' : null;
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

const getFirstText = (value: Record<string, unknown>, fieldNames: string[]): string => {
  for (const fieldName of fieldNames) {
    const text = toHumanReadableRoastText(value[fieldName]);

    if (text) {
      return text;
    }
  }

  return '';
};

const getFirstRecord = (value: Record<string, unknown>, fieldNames: string[]): Record<string, unknown> | null => {
  for (const fieldName of fieldNames) {
    const candidate = value[fieldName];

    if (isRecord(candidate)) {
      return candidate;
    }
  }

  return null;
};

const getFirstArray = (value: Record<string, unknown>, fieldNames: string[]): unknown[] => {
  for (const fieldName of fieldNames) {
    const candidate = value[fieldName];

    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
};

const inferPrimaryArea = (text: string): RoastAnalysisPrimaryAdjustment['area'] => {
  if (/发展|一爆|development/i.test(text)) {
    return 'development';
  }

  if (/升温率|ror|rate\s*of\s*rise/i.test(text)) {
    return 'ror';
  }

  if (/火力|能量|热量|入豆|炉温|heat|energy|fire/i.test(text)) {
    return 'energy';
  }

  return 'insufficient_data';
};

const inferPrimaryDirection = (text: string): RoastAnalysisPrimaryAdjustment['direction'] => {
  if (/降低|减少|缩短|提前|下调|decrease|reduce/i.test(text)) {
    return 'decrease';
  }

  if (/提高|增加|延长|推迟|上调|increase|raise/i.test(text)) {
    return 'increase';
  }

  if (/保持|维持|maintain|keep/i.test(text)) {
    return 'maintain';
  }

  return 'observe';
};

const toConfidence = (value: unknown): number => {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value.replace('%', '').trim())
      : Number.NaN;

  return Number.isFinite(candidate) ? Math.round(Math.min(100, Math.max(0, candidate))) : 0;
};

export const normalizeRoastAnalysisResult = (value: unknown): RoastAnalysisResult | null => {
  if (!isRecord(value)) {
    return null;
  }

  const summary = getFirstText(value, ['summary', 'overallReview', 'overall_review', 'analysis', 'review', 'conclusion']);
  const primaryAdjustmentValue = getFirstRecord(value, [
    'primaryAdjustment',
    'primary_adjustment',
    'mainAdjustment',
    'main_adjustment',
    'primaryStrategy',
    'primary_strategy',
    '核心策略',
    '主要调整',
  ]);
  const issueItems = getFirstArray(value, ['issues', 'problems', 'defects', 'observations', 'keyIssues', 'key_issues', '明显瑕疵']);
  const nextAdjustmentItems = getFirstArray(value, [
    'nextRoastAdjustments',
    'next_roast_adjustments',
    'adjustments',
    'recommendations',
    'nextActions',
    'next_actions',
    '下一次调整',
    '下次建议',
  ]);
  const primaryAdjustment = isRecord(primaryAdjustmentValue)
    ? {
        action: toHumanReadableRoastText(primaryAdjustmentValue.action ?? primaryAdjustmentValue.adjustment ?? primaryAdjustmentValue.recommendation),
        area: toPrimaryArea(primaryAdjustmentValue.area),
        direction: toPrimaryDirection(primaryAdjustmentValue.direction),
        rationale: toHumanReadableRoastText(primaryAdjustmentValue.rationale ?? primaryAdjustmentValue.reason ?? primaryAdjustmentValue.evidence),
      }
    : null;
  const issues = issueItems
    .filter(isRecord)
    .map((issue) => ({
      category: toHumanIssueCategory(issue.category ?? issue.area ?? issue.title ?? issue.name),
      evidence: toHumanReadableRoastText(issue.evidence ?? issue.observation ?? issue.description ?? issue.reason),
      severity: toSeverity(issue.severity ?? issue.priority ?? issue.level),
    }))
    .filter((issue) => issue.category.length > 0 && issue.evidence.length > 0)
    .slice(0, 6);
  const nextRoastAdjustments = nextAdjustmentItems
    .map((item) => {
      if (isRecord(item)) {
        return toHumanReadableRoastText(item.suggestion ?? item.action ?? item.recommendation ?? item.adjustment ?? item.description);
      }

      return toHumanReadableRoastText(item);
    })
    .filter((item) => item.length > 0)
    .slice(0, 6);
  if (!summary) {
    return null;
  }

  const fallbackAction = nextRoastAdjustments.length > 0
    ? nextRoastAdjustments[0]
    : issues.length > 0
      ? issues[0].evidence
      : '先核对本次曲线关键节点，再决定下一炉调整。';
  const fallbackRationale = issues.length > 0 ? issues[0].evidence : summary;
  const primaryAction = toOptionalNonEmptyText(primaryAdjustment?.action);
  const primaryRationale = toOptionalNonEmptyText(primaryAdjustment?.rationale);

  const resolvedPrimaryAdjustment = {
    action: primaryAction ?? fallbackAction,
    area: primaryAdjustment?.area ?? inferPrimaryArea(`${summary}\n${fallbackAction}\n${fallbackRationale}`),
    direction: primaryAdjustment?.direction ?? inferPrimaryDirection(`${fallbackAction}\n${fallbackRationale}`),
    rationale: primaryRationale ?? fallbackRationale,
  };

  return {
    confidence: toConfidence(value.confidence),
    issues,
    nextRoastAdjustments,
    primaryAdjustment: {
      action: resolvedPrimaryAdjustment.action,
      area: resolvedPrimaryAdjustment.area,
      direction: resolvedPrimaryAdjustment.direction,
      rationale: resolvedPrimaryAdjustment.rationale,
    },
    summary,
  };
};
