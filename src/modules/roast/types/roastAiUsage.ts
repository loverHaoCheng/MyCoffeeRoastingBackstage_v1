export type RoastAiFeature =
  | 'roast_analysis'
  | 'roast_plan_recommendation'
  | 'roast_training_recommendation';

export interface RoastAiUsage {
  enabled: boolean;
  monthlyLimit: number;
  remainingUses: number;
  usedThisMonth: number;
}
