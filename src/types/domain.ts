export interface EntityTimestamps {
  createdAt: string;
  updatedAt: string;
}

export interface Bean extends EntityTimestamps {
  id: number;
  name: string;
  origin: string;
  process: string;
  grade: string;
  stockKg: number;
  costPerKg: number;
  supplierId: number;
}

export interface RoastPlan extends EntityTimestamps {
  id: number;
  name: string;
  beanName: string;
  beanId: number;
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
  firePower: string;
  note?: string;
}

export interface RoastBatch extends EntityTimestamps {
  id: number;
  planId: number;
  batchNo: string;
  inputKg: number;
  outputKg: number;
  roastLevel: string;
  developmentRatio: number;
  status: 'queued' | 'roasting' | 'cooling' | 'completed';
}

export interface InventoryItem extends EntityTimestamps {
  id: number;
  beanId: number;
  location: string;
  quantityKg: number;
  reservedKg: number;
  safetyStockKg: number;
}

export interface ProductionBatch extends EntityTimestamps {
  id: number;
  batchNo: string;
  roastPlanId: number;
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
