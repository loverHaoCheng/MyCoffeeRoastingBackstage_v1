import type { Bean } from '@/types/domain';

export const matchesKeyword = (bean: Bean, keyword: string): boolean => {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  return [bean.name, bean.origin, bean.process, bean.grade, bean.flavorTags?.join(' ') ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
};

export const sortBeansByCreatedAt = (beans: Bean[]): Bean[] => {
  return [...beans].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
};

export const getBeanRemainingWeightGrams = (bean: Bean): number => {
  return Math.max(0, Math.round(bean.remainingWeightGrams ?? bean.stockKg * 1000));
};

export const getFilterOptions = (values: (null | string | undefined)[]) => {
  return Array.from(new Set(values.map((value) => value?.trim() ?? '').filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))
    .map((value) => ({ label: value, value }));
};
