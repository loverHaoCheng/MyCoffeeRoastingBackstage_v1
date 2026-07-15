import type { RoastPlanDisposition } from '@/modules/bean/services';
import { GENERIC_BEAN_ID, GENERIC_BEAN_NAME } from '@/modules/roast/services/roast-plan/roastPlan.service.state';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { RoastPlan } from '@/types/domain';

export const detachDeletedPlanFromBatches = (
  batches: RoastBatchRecord[],
  planId: RoastPlan['id'],
): RoastBatchRecord[] => {
  return batches.map((batch) =>
    String(batch.roastPlanId) === String(planId)
      ? {
          ...batch,
          roastPlanId: undefined,
          roastPlanName: undefined,
          updatedAt: new Date().toISOString(),
        }
      : batch,
  );
};

export const syncDeletedBeanBatches = (
  batches: RoastBatchRecord[],
  beanId: RoastPlan['beanId'],
): RoastBatchRecord[] => {
  return batches.filter((batch) => batch.greenBeanId !== String(beanId));
};

export const syncDeletedBeanPlans = (
  plans: RoastPlan[],
  beanId: RoastPlan['beanId'],
  disposition: RoastPlanDisposition,
): RoastPlan[] => {
  if (disposition === 'delete') {
    return plans.filter((plan) => String(plan.beanId) !== String(beanId));
  }

  return plans.map((plan) =>
    String(plan.beanId) === String(beanId)
      ? {
          ...plan,
          beanId: GENERIC_BEAN_ID,
          beanName: GENERIC_BEAN_NAME,
          updatedAt: new Date().toISOString(),
        }
      : plan,
  );
};
