import type { RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import { normalizeRoastLevel } from '@/modules/roast/constants/roastLevel';

export const createRoastBatchDraft = (batch: RoastBatchRecord | null): RoastBatchUpdateInput | null => {
  if (!batch) {
    return null;
  }

  return {
    beanAgtronColor: batch.beanAgtronColor,
    developmentRatio: batch.developmentRatio,
    firstCrackTime: batch.firstCrackTime,
    groundAgtronColor: batch.groundAgtronColor,
    greenBeanId: batch.greenBeanId,
    greenBeanName: batch.greenBeanName,
    inputWeightGrams: batch.inputWeightGrams,
    notes: batch.notes,
    outputWeightGrams: batch.outputWeightGrams,
    roastDate: batch.roastDate,
    roastLevel: normalizeRoastLevel(batch.roastLevel),
    roastLevelSource: batch.roastLevelSource ?? 'dehydrationRate',
    roastPlanId: batch.roastPlanId,
    roastPlanName: batch.roastPlanName,
    roastedBeanName: batch.roastedBeanName,
    salesMode: batch.salesMode,
    soldUnitCount: batch.soldUnitCount,
    status: batch.status,
    totalRoastTime: batch.totalRoastTime,
  };
};
