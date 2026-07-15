export interface EntityTimestamps {
  createdAt: string;
  updatedAt: string;
}

export interface Bean extends EntityTimestamps {
  id: number | string;
  agingDays?: number;
  altitudeMetersMax?: number | null;
  altitudeMetersMin?: number | null;
  name: string;
  code?: string;
  defaultRoastInputGrams?: number;
  defaultSaleUnitPrice?: number | null;
  defaultSaleUnitWeightGrams?: number | null;
  densityGPerL?: number | null;
  flavorTags?: string[];
  harvestSeason?: string;
  millName?: string | null;
  moisturePercent?: number | null;
  notes?: string | null;
  costTemplateId?: string | null;
  origin: string;
  originArea?: string | null;
  originCountry?: string | null;
  originRegion?: string | null;
  process: string;
  grade: string;
  purchaseDate?: string | null;
  purchasedTotalPrice?: number | null;
  purchasedWeightGrams?: number | null;
  remainingWeightGrams?: number | null;
  stockKg: number;
  costPerKg: number;
  tastingEndDays?: number;
  supplierId?: number | null;
  supplierName?: string | null;
  // 扩展字段：从远端库存汇总视图获取
  variety?: string;
}

export interface RoastPlan extends EntityTimestamps {
  id: number | string;
  name: string;
  beanName: string;
  beanId: Bean['id'];
  roasterModel: string;
  batchWeightGrams: number;
  plannedBatchKg: number;
  targetRoastLevel: string;
  roastPurpose: string;
  status: 'draft' | 'inProgress' | 'completed' | 'cancelled';
  steps: RoastPlanStep[];
}

export interface RoastPlanStep {
  id: number;
  timeLabel: string;
  eventName: string;
  operation: string;
  drumTemperature: string;
  airTemperature: string;
  firePower: string;
  drumSpeed: string;
  note?: string;
}

export interface RoastBatch extends EntityTimestamps {
  id: number;
  planId: RoastPlan['id'];
  batchNo: string;
  inputKg: number;
  outputKg: number;
  roastLevel: string;
  developmentRatio: number;
  status: 'queued' | 'roasting' | 'cooling' | 'completed';
}

export interface InventoryItem extends EntityTimestamps {
  id: number;
  beanId: Bean['id'];
  location: string;
  quantityKg: number;
  reservedKg: number;
  safetyStockKg: number;
}

export interface ProductionBatch extends EntityTimestamps {
  id: number;
  batchNo: string;
  roastPlanId: RoastPlan['id'];
  roastBatchId: number;
  packageSpec: string;
  plannedOutput: number;
  completedOutput: number;
  status: 'planned' | 'packing' | 'completed' | 'paused';
}

export interface CostRecord extends EntityTimestamps {
  id: number;
  targetType: 'bean' | 'roastBatch' | 'productionBatch';
  targetId: number;
  materialCost: number;
  laborCost: number;
  energyCost: number;
  totalCost: number;
}
