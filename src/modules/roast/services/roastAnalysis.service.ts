import { httpClient } from '@/services/httpClient';

export interface RoastAnalysisResult {
  confidence: number;
  issues: { category: string; evidence: string; severity: 'high' | 'low' | 'medium' }[];
  nextRoastAdjustments: string[];
  primaryAdjustment: { action: string; area: string; direction: string; rationale: string };
  summary: string;
}

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
  machine: { model: string; notes: string };
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

export const roastAnalysisService = {
  async getStatus(roastBatchId: string): Promise<RoastAnalysisResult | null> {
    const response = await httpClient.get<{ analysis: RoastAnalysisResult | null }>(`/ai/roast-analysis?${new URLSearchParams({ roastBatchId }).toString()}`);
    return response.data.analysis;
  },
  async analyze(input: RoastAnalysisRequest): Promise<RoastAnalysisResult> {
    const response = await httpClient.post<{ analysis: RoastAnalysisResult }>('/ai/roast-analysis', input);
    return response.data.analysis;
  },
};
