import type { RoastPlan } from '@/types/domain';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';

export const roastPlanStatusLabelMap: Record<RoastPlan['status'], string> = {
  cancelled: '已取消 · 该计划已停用',
  completed: '已完成 · 已生成烘焙结果',
  draft: '草稿 · 仅计划未执行',
  inProgress: '进行中 · 正在烘焙',
};

const hasLinkedBatch = (
  planId: RoastPlan['id'],
  batch: Pick<RoastBatchRecord, 'roastPlanId'>,
): boolean => {
  return (batch.roastPlanId ?? '') === String(planId);
};

export const getEffectiveRoastPlanStatus = (
  plan: Pick<RoastPlan, 'id' | 'status'>,
  batches: Pick<RoastBatchRecord, 'roastPlanId' | 'status'>[],
): RoastPlan['status'] => {
  if (plan.status === 'cancelled' || plan.status === 'completed') {
    return plan.status;
  }

  const linkedBatches = batches.filter((batch) => hasLinkedBatch(plan.id, batch));

  if (linkedBatches.length === 0) {
    return plan.status;
  }

  if (linkedBatches.some((batch) => batch.status === 'completed')) {
    return 'completed';
  }

  return 'inProgress';
};
