import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';

export const getRoastBatchDisplayName = (batch: RoastBatchRecord): string => {
  const roastedBeanName = batch.roastedBeanName?.trim();

  return roastedBeanName && roastedBeanName.length > 0 ? roastedBeanName : batch.greenBeanName;
};
