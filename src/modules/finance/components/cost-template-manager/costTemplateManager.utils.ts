import type { CostTemplate, CostTemplateFormValues } from '@/modules/settings/types';

export const mapCostTemplateToFormValues = (template: CostTemplate): CostTemplateFormValues => ({
  dehydrationRate: template.dehydrationRate,
  energyCost: template.energyCost,
  laborCost: template.laborCost,
  name: template.name,
  notes: template.notes,
  otherCost: template.otherCost,
  packagingCost: template.packagingCost,
  roastInputWeightGrams: template.roastInputWeightGrams,
  saleUnitWeightGrams: template.saleUnitWeightGrams,
  targetProfitRate: template.targetProfitRate,
});

export const joinClassNames = (...classNames: (string | undefined)[]) => {
  return classNames.filter(Boolean).join(' ');
};
