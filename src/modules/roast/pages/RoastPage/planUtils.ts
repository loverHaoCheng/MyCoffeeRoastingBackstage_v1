import type { RoastPlan } from '@/types/domain';

export const matchesKeyword = (plan: RoastPlan, keyword: string): boolean => {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;
  return [plan.name, plan.beanName, plan.roasterModel, plan.targetRoastLevel, plan.roastPurpose]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalized);
};

export const sortPlansByUpdatedAt = (plans: RoastPlan[]): RoastPlan[] => {
  return [...plans].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
};
