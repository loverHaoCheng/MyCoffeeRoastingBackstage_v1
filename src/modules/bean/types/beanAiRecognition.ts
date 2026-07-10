export interface BeanImageRecognitionResult {
  altitudeMetersMax: null | number;
  altitudeMetersMin: null | number;
  code: string;
  densityGPerL: null | number;
  displayName: string;
  flavorTags: string[];
  grade: string;
  harvestSeason: string;
  millName: string;
  moisturePercent: null | number;
  notes: string;
  originArea: string;
  originCountry: string;
  originRegion: string;
  processMethod: string;
  supplierName: string;
  variety: string;
}

export interface BeanImageRecognitionResponse {
  monthlyLimit: number;
  recognition: BeanImageRecognitionResult;
  remainingUses: number;
  usedThisMonth: number;
}

export interface BeanImageRecognitionUsage {
  enabled: boolean;
  monthlyLimit: number;
  remainingUses: number;
  usedThisMonth: number;
}
