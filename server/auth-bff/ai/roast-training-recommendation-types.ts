import { isRecord, toTrimmedString } from '../utils.js';

export interface RoastPlanDraftStep {
  airTemperature: string;
  drumSpeed: string;
  event: string;
  firePower: string;
  note?: string;
  operation: string;
  temperature: string;
  time: string;
}

export interface RoastPlanDraft {
  batchWeightGrams: number;
  beanId?: number | string;
  beanName: string;
  name: string;
  purpose?: string;
  roastLevel: string;
  roasterMachineId?: string;
  roasterModel: string;
  steps: RoastPlanDraftStep[];
}

export interface RoastTrainingRecommendationAdjustment {
  area: string;
  observation: string;
  expectedResult?: string;
  priority: 'high' | 'low' | 'medium';
  rationale?: string;
  suggestion: string;
}

export interface RoastTrainingRecommendationResult {
  adjustments: RoastTrainingRecommendationAdjustment[];
  confidence: number;
  modifiedPlanJson: RoastPlanDraft;
  overallReview: string;
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number(value.trim());

  return Number.isFinite(parsed) ? parsed : undefined;
};

const toBeanId = (value: unknown): number | string | undefined => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  const text = toTrimmedString(value);

  return text ? text : undefined;
};

const toPriority = (value: unknown): RoastTrainingRecommendationAdjustment['priority'] => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (normalized === 'high' || normalized === '高') {
    return 'high';
  }

  if (normalized === 'medium' || normalized === '中') {
    return 'medium';
  }

  return 'low';
};

const textReplacements: [RegExp, string][] = [
  [/\bdata_integrity\b/gi, '曲线记录'],
  [/\bror_consistency\b/gi, '升温率记录'],
  [/\broast\.totalTimeSeconds\b/g, '总烘焙时长'],
  [/\bcurve\.samples\b/g, '曲线采样点'],
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

const areaLabels: Record<string, string> = {
  acidity: '酸质表现',
  development: '发展期',
  drying: '干燥期',
  energy: '能量供应',
  flavor: '风味表现',
  machine: '机器响应',
  maillard: '梅纳反应',
  ror: '升温率',
  sweetness: '甜感表现',
};

const toHumanReadableText = (value: unknown): string => {
  return textReplacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), toTrimmedString(value));
};

const toHumanReadableArea = (value: unknown): string => {
  const text = toHumanReadableText(value);
  const normalized = text.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');

  return areaLabels[normalized] ?? text;
};

const normalizeStep = (value: unknown, fallback: RoastPlanDraftStep): RoastPlanDraftStep => {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    airTemperature: toHumanReadableText(value.airTemperature ?? value.air_temperature) || fallback.airTemperature,
    drumSpeed: toHumanReadableText(value.drumSpeed ?? value.drum_speed) || fallback.drumSpeed,
    event: toHumanReadableText(value.event ?? value.eventName ?? value.event_name) || fallback.event,
    firePower: toHumanReadableText(value.firePower ?? value.fire_power) || fallback.firePower,
    note: toHumanReadableText(value.note) || fallback.note,
    operation: toHumanReadableText(value.operation) || fallback.operation,
    temperature:
      toHumanReadableText(value.temperature ?? value.drumTemperature ?? value.drum_temperature) || fallback.temperature,
    time: toHumanReadableText(value.time ?? value.timeLabel ?? value.time_label) || fallback.time,
  };
};

export const normalizeRoastPlanDraft = (value: unknown, fallback: RoastPlanDraft): RoastPlanDraft => {
  if (!isRecord(value)) {
    return fallback;
  }

  const fallbackSteps = fallback.steps.length > 0 ? fallback.steps : [
    {
      airTemperature: '-',
      drumSpeed: '-',
      event: '入豆',
      firePower: '',
      operation: '入豆',
      temperature: '-',
      time: '0:00',
    },
  ];
  const inputSteps = Array.isArray(value.steps) ? value.steps : [];
  const steps = inputSteps.length > 0
    ? inputSteps.map((step, index) => normalizeStep(step, fallbackSteps[index] ?? fallbackSteps[0]))
    : fallbackSteps;
  const beanId = toBeanId(value.beanId ?? value.bean_id);

  return {
    batchWeightGrams:
      toFiniteNumber(value.batchWeightGrams ?? value.batch_weight_grams) ?? fallback.batchWeightGrams,
    beanId: beanId ?? fallback.beanId,
    beanName: toTrimmedString(value.beanName ?? value.bean_name) || fallback.beanName,
    name: toTrimmedString(value.name) || fallback.name,
    purpose: toTrimmedString(value.purpose ?? value.roastPurpose ?? value.roast_purpose) || fallback.purpose,
    roastLevel: toTrimmedString(value.roastLevel ?? value.targetRoastLevel ?? value.target_roast_level) || fallback.roastLevel,
    roasterMachineId:
      toTrimmedString(value.roasterMachineId ?? value.roaster_machine_id) || fallback.roasterMachineId,
    roasterModel: toTrimmedString(value.roasterModel ?? value.roaster_model) || fallback.roasterModel,
    steps,
  };
};

export const normalizeRoastTrainingRecommendationResult = (
  value: unknown,
  fallbackPlanDraft: RoastPlanDraft,
): RoastTrainingRecommendationResult | null => {
  if (!isRecord(value)) {
    return null;
  }

  const overallReview = toHumanReadableText(value.overallReview ?? value.overall_review ?? value.summary);
  const planCandidate = value.modifiedPlanJson ?? value.modified_plan_json ?? value.planDraft ?? value.plan_draft;

  if (!overallReview) {
    return null;
  }

  const adjustments = Array.isArray(value.adjustments)
    ? value.adjustments
        .filter(isRecord)
        .map((adjustment) => ({
          area: toHumanReadableArea(adjustment.area),
          expectedResult: toHumanReadableText(adjustment.expectedResult ?? adjustment.expected_result),
          observation: toHumanReadableText(adjustment.observation ?? adjustment.currentObservation ?? adjustment.evidence),
          priority: toPriority(adjustment.priority),
          rationale: toHumanReadableText(adjustment.rationale ?? adjustment.reason ?? adjustment.adjustmentReason),
          suggestion: toHumanReadableText(adjustment.suggestion ?? adjustment.recommendation ?? adjustment.action),
        }))
        .filter((adjustment) => adjustment.area.length > 0 && adjustment.suggestion.length > 0)
        .slice(0, 6)
    : [];
  const confidence = toFiniteNumber(value.confidence);

  return {
    adjustments,
    confidence: Math.round(Math.min(100, Math.max(0, confidence ?? 0))),
    modifiedPlanJson: normalizeRoastPlanDraft(planCandidate, fallbackPlanDraft),
    overallReview,
  };
};
