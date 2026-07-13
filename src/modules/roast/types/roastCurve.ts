export type RoastCurveSource = 'hibean';

export interface RoastCurvePoint {
  timeSeconds: number;
  beanTemperature?: number;
  environmentTemperature?: number;
  rateOfRise?: number;
  heatPower?: number;
  fanSpeed?: number;
  drumSpeed?: number;
}

export type RoastCurveEventType =
  | 'preheat'
  | 'charge'
  | 'turningPoint'
  | 'dryEnd'
  | 'firstCrackStart'
  | 'firstCrackEnd'
  | 'drop'
  | 'unknown';

export interface RoastCurveEvent {
  code: number;
  label: string;
  temperature?: number;
  temperatureUnit: string;
  timeSeconds: number;
  type: RoastCurveEventType;
}

export interface RoastCurvePhase {
  durationSeconds: number;
  label: string;
  percentage: number;
  phase: number;
}

export interface RoastCurveMetrics {
  chargeTime?: number;
  chargeTemperature?: number;
  developmentRatio?: number;
  developmentTime?: number;
  dryEndTime?: number;
  dryEndTemperature?: number;
  dropTime?: number;
  dropTemperature?: number;
  firstCrackTime?: number;
  firstCrackTemperature?: number;
  roastDuration?: number;
  turningPointTime?: number;
  turningPointTemperature?: number;
}

export interface RoastCurveDeviceInfo {
  manufacturer?: string;
  model?: string;
  name?: string;
}

export interface RoastCurveBeanSnapshot {
  greenBeanWeightGrams?: number;
  name?: string;
  origin?: string;
  processingMethod?: number;
  regionCode?: string;
}

export interface RoastCurveRecord {
  id: string;
  beanSnapshot?: RoastCurveBeanSnapshot;
  curveData: RoastCurvePoint[];
  deviceInfo?: RoastCurveDeviceInfo;
  eventList: RoastCurveEvent[];
  importedAt: string;
  metrics: RoastCurveMetrics;
  originalFileName?: string;
  phaseList: RoastCurvePhase[];
  roastBatchId: string;
  sampleInterval: number;
  source: RoastCurveSource;
  sourceVersion: string;
  temperatureUnit: string;
  updatedAt: string;
}

export interface RoastCurveImportInput {
  fileName?: string;
  jsonText: string;
  roastBatchId: string;
}

export interface RoastCurveImportResult {
  batchSummary: {
    developmentRatio?: number;
    firstCrackTime?: number;
    totalRoastTime?: number;
  };
  record: RoastCurveRecord;
}
