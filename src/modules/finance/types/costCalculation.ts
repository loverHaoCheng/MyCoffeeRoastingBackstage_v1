export type FinanceDataSource = 'greenBean' | 'roastedBean';

export interface CostCalculationFormInput {
  beanId: string;
  beanName: string;
  calculationName: string;
  purchaseCostPerKg: number;
  dehydrationRate: number;
  roastInputWeightGrams: number;
  packagingCost: number;
  energyCost: number;
  laborCost: number;
  otherCost: number;
  saleUnitWeightGrams: number;
  saleUnitPrice: number;
  targetProfitRate: number;
  notes?: null | string;
}

export interface CostCalculationMetrics {
  greenBeanCost: number;
  roastedOutputWeightGrams: number;
  totalBatchCost: number;
  costPerRoastedKg: number;
  costPerSaleUnit: number;
  suggestedSalePrice: number;
  profitPerSaleUnit: number;
  profitRate: number;
  saleUnitCount: number;
}

export interface CostCalculationRecord extends CostCalculationFormInput, CostCalculationMetrics {
  createdAt: string;
  dataSource: FinanceDataSource;
  id: string;
  updatedAt: string;
}
