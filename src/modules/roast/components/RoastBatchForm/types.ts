import type { RoastBatchEvaluation, RoastBatchSalesMode, RoastLevelSource } from '@/modules/roast/types/roastBatch';

export interface RoastBatchFormState {
  evaluation: RoastBatchEvaluation;
  roastDate: string;
  greenBeanId: string;
  greenBeanName: string;
  roastedBeanName: string;
  salesMode: RoastBatchSalesMode;
  roastPlanId: string;
  roastPlanName: string;
  inputWeightGrams: number;
  outputWeightGrams: number;
  roastLevel: string;
  roastLevelSource: RoastLevelSource;
  beanAgtronColor: number | undefined;
  groundAgtronColor: number | undefined;
  developmentRatio: number | undefined;
  firstCrackTime: number | undefined;
  totalRoastTime: number | undefined;
  finalSaleUnitPrice: number | undefined;
  soldUnitCount: number;
  notes: string;
}

export interface RoastBatchFormSubmitValue {
  evaluation: RoastBatchEvaluation;
  developmentRatio: number | undefined;
  firstCrackTime: number | undefined;
  greenBeanId: string;
  greenBeanName: string;
  inputWeightGrams: number;
  notes: string | undefined;
  outputWeightGrams: number;
  roastDate: string;
  roastLevel: string;
  roastLevelSource: RoastLevelSource;
  beanAgtronColor: number | undefined;
  groundAgtronColor: number | undefined;
  roastPlanId: string | undefined;
  roastPlanName: string | undefined;
  roastedBeanName: string;
  salesMode: RoastBatchSalesMode;
  totalRoastTime: number | undefined;
  finalSaleUnitPrice: number | null | undefined;
  saleUnitPriceSnapshot: number | undefined;
  beanCostPerSaleUnitSnapshot: number | undefined;
  nonBeanCostPerSaleUnitSnapshot: number | undefined;
  soldUnitCount: number;
}
