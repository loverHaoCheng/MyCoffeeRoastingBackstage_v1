import type { RoastPlanJsonInput } from './roastPlanJson';

export interface RoastTrainingReadinessItem {
  key: 'bean' | 'consent' | 'curve' | 'evaluation' | 'roastPlan' | 'target';
  label: string;
  ready: boolean;
}

export interface RoastTrainingRecommendationAdjustment {
  area: string;
  expectedResult?: string;
  observation: string;
  priority: 'high' | 'low' | 'medium';
  rationale?: string;
  suggestion: string;
}

export interface RoastTrainingRecommendation {
  adjustments: RoastTrainingRecommendationAdjustment[];
  confidence: number;
  modifiedPlanJson: RoastPlanJsonInput;
  recommendationId: string;
  overallReview: string;
  status: string;
}

export interface RoastTrainingUploadStatus {
  alreadyUploaded: boolean;
  disabledReason?: string;
  enabled: boolean;
  environment: string;
  recommendation?: RoastTrainingRecommendation;
  readiness?: {
    isUploadReady: boolean;
    items: RoastTrainingReadinessItem[];
    missingLabels: string[];
  };
  roastBatchId: string;
  uploadId?: string;
}

export interface RoastTrainingUploadResult {
  recommendation?: RoastTrainingRecommendation;
  sampleId: string;
  uploadId: string;
}

export interface RoastTrainingRecommendationConfirmResult {
  recommendation?: RoastTrainingRecommendation;
}
