export interface RoastTrainingReadinessItem {
  key: 'bean' | 'consent' | 'curve' | 'evaluation' | 'roastPlan' | 'target';
  label: string;
  ready: boolean;
}

export interface RoastTrainingUploadStatus {
  alreadyUploaded: boolean;
  disabledReason?: string;
  enabled: boolean;
  environment: string;
  readiness?: {
    isUploadReady: boolean;
    items: RoastTrainingReadinessItem[];
    missingLabels: string[];
  };
  roastBatchId: string;
  uploadId?: string;
}

export interface RoastTrainingUploadResult {
  sampleId: string;
  uploadId: string;
}
