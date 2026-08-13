export type RoastAiFeature =
  | 'roast_analysis'
  | 'roast_general_question'
  | 'roast_plan_recommendation';

export interface RoastAiUsage {
  enabled: boolean;
  monthlyLimit: number;
  remainingUses: number;
  usedThisMonth: number;
}
