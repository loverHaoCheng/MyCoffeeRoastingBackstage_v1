import type { RoastPlanJsonInput } from './roastPlanJson';

export interface RoastPlanRecommendationInput {
  batchWeightGrams: number;
  beanId: string;
  flavorExpectation: string;
  planName: string;
  purpose?: string;
  roastLevel: string;
  roasterMachineId: string;
}

export interface RoastPlanRecommendationAdjustment {
  area: string;
  expectedResult?: string;
  observation: string;
  priority: 'high' | 'low' | 'medium';
  rationale?: string;
  suggestion: string;
}

export interface RoastPlanRecommendation {
  adjustments: RoastPlanRecommendationAdjustment[];
  confidence: number;
  modifiedPlanJson: RoastPlanJsonInput;
  overallReview: string;
}

export interface RoastPlanRecommendationResult {
  recommendation: RoastPlanRecommendation;
}
