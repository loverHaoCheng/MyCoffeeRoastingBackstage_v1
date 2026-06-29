import type { Bean } from '@/types/domain';

export interface RoastPlanJsonStep {
  time: string;
  event: string;
  operation: string;
  temperature: string;
  firePower: string;
  note?: string;
}

export interface RoastPlanJsonInput {
  name: string;
  beanName: string;
  beanId?: Bean['id'];
  batchWeightGrams: number;
  roastLevel: string;
  purpose?: string;
  steps: RoastPlanJsonStep[];
}
