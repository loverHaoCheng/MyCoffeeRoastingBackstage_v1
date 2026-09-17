import type { RoastPlan } from '@/types/domain';

export type RoastPlanFilterKey = 'bean' | 'level' | 'purpose';

export const getFilterOptions = (values: string[]) => Array.from(new Set(values.filter(Boolean)))
  .sort((left, right) => left.localeCompare(right, 'zh-CN'))
  .map((value) => ({ label: value, value }));
