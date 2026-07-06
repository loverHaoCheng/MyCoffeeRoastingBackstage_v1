export interface GreenBeanLotProfile {
  id: string;
  code: string;
  displayName: string;
  grade?: string | null;
  originCountry: string;
  originRegion: string;
  originArea?: string | null;
  variety: string;
  harvestSeason: string;
  processMethod: string;
  altitudeMetersMin?: number | null;
  altitudeMetersMax?: number | null;
  moisturePercent?: number | null;
  densityGPerL?: number | null;
  millName?: string | null;
  defaultRoastInputGrams: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GreenBeanPurchaseBatch {
  id: string;
  greenBeanId: string;
  supplierName?: string | null;
  invoiceNo?: string | null;
  purchasedWeightGrams: number;
  purchasedTotalPrice: number;
  purchasedUnitPricePerKg: number;
  remainingWeightGrams: number;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BeanSaleSpec {
  id: string;
  greenBeanId: string;
  channel: string;
  isDefault: boolean;
  unitWeightGrams: number;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoastProfileStep {
  timeLabel: string;
  eventName: string;
  operation: string;
  drumTemperature: string;
  firePower: string;
  note?: string | null;
}

export interface RoastProfileDefinition {
  id: string;
  greenBeanId: string;
  name: string;
  targetRoastLevel?: string | null;
  roastPurpose?: string | null;
  steps: RoastProfileStep[];
  createdAt: string;
  updatedAt: string;
}

export interface RoastRecord {
  id: string;
  greenBeanId: string;
  purchaseBatchId?: string | null;
  roastProfileId?: string | null;
  roastDate: string;
  inputWeightGrams: number;
  outputWeightGrams?: number | null;
  roasterName?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GreenBeanInventorySnapshot {
  greenBeanId: string;
  displayName: string;
  totalPurchasedWeightGrams: number;
  totalRemainingWeightGrams: number;
  weightedCostPerKg: number;
  roastRecordCount: number;
  defaultSaleUnitWeightGrams?: number | null;
  defaultSaleUnitPrice?: number | null;
  updatedAt: string;
}
