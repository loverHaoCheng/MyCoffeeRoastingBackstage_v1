import type { RoastPlan } from '@/types/domain';

export type RoastPlanSortKey = 'nameAsc' | 'updatedAsc' | 'updatedDesc' | 'weightAsc' | 'weightDesc';

export const sortPlans = (plans: RoastPlan[], sortKey: RoastPlanSortKey): RoastPlan[] => [...plans].sort((left, right) => {
  switch (sortKey) {
    case 'nameAsc': return left.name.localeCompare(right.name, 'zh-CN');
    case 'updatedAsc': return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
    case 'weightAsc': return left.batchWeightGrams - right.batchWeightGrams;
    case 'weightDesc': return right.batchWeightGrams - left.batchWeightGrams;
    default: return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  }
});
