import type { RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import type { Bean, RoastPlan } from '@/types/domain';
import type { RoastBatchEditableFieldPath } from './fieldLabels';

export const updateRoastBatchDraft = (
  draft: RoastBatchUpdateInput,
  key: RoastBatchEditableFieldPath,
  value: unknown,
  beans: Bean[],
  plans: RoastPlan[],
): RoastBatchUpdateInput => {
  const nextDraft: RoastBatchUpdateInput = { ...draft };
  nextDraft[key] = value as never;

  if (key === 'greenBeanId') {
    const nextBean = beans.find((bean) => String(bean.id) === String(value));
    nextDraft.greenBeanName = nextBean?.name ?? nextDraft.greenBeanName ?? '';
    nextDraft.roastPlanId = undefined;
    nextDraft.roastPlanName = undefined;
  }

  if (key === 'roastPlanId') {
    const nextPlan = plans.find((plan) => String(plan.id) === String(value));
    nextDraft.roastPlanName = nextPlan?.name ?? undefined;
  }

  if (key === 'roastedBeanName' && typeof value === 'string' && value.trim().length === 0) {
    nextDraft.roastedBeanName = undefined;
  }

  return nextDraft;
};
