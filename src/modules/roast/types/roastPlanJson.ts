import type { Bean } from '@/types/domain';

export interface RoastPlanJsonStep {
  time: string;
  event: string;
  operation: string;
  temperature: string;
  airTemperature: string;
  firePower: string;
  drumSpeed: string;
  note?: string;
}

export interface RoastPlanJsonInput {
  name: string;
  beanName: string;
  beanId?: Bean['id'];
  roasterMachineId?: string;
  roasterModel: string;
  batchWeightGrams: number;
  roastLevel: string;
  purpose?: string;
  steps: RoastPlanJsonStep[];
}
