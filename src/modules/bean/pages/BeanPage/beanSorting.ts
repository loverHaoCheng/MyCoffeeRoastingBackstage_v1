import type { Bean } from '@/types/domain';
import { getBeanRemainingWeightGrams } from './beanUtils';

export type BeanSortKey = 'costAsc' | 'costDesc' | 'createdAsc' | 'createdDesc' | 'stockAsc' | 'stockDesc';

export const sortBeans = (beans: Bean[], sortKey: BeanSortKey): Bean[] => {
  return [...beans].sort((left, right) => {
    switch (sortKey) {
      case 'createdAsc': return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      case 'costAsc': return left.costPerKg - right.costPerKg;
      case 'costDesc': return right.costPerKg - left.costPerKg;
      case 'stockAsc': return getBeanRemainingWeightGrams(left) - getBeanRemainingWeightGrams(right);
      case 'stockDesc': return getBeanRemainingWeightGrams(right) - getBeanRemainingWeightGrams(left);
      default: return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
  });
};
