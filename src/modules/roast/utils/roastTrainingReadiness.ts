import type { RoastBatchEvaluation, RoastBatchRecord } from '@/modules/roast/types/roastBatch';

export interface RoastTrainingReadinessItem {
  detail: string;
  key: 'bean' | 'curve' | 'evaluation' | 'roastPlan' | 'target';
  label: string;
  ready: boolean;
}

export interface RoastTrainingReadinessSummary {
  completionCount: number;
  isUploadReady: boolean;
  items: RoastTrainingReadinessItem[];
  missingLabels: string[];
}

const hasText = (value: string | undefined): boolean => {
  return value != null && value.trim().length > 0;
};

export const isRoastEvaluationReady = (evaluation: RoastBatchEvaluation): boolean => {
  const hasScore = evaluation.overallScore != null;
  const hasTargetScore = evaluation.targetMatchScore != null;
  const hasSummaryNotes =
    hasText(evaluation.flavorNotes) ||
    hasText(evaluation.defectNotes) ||
    hasText(evaluation.nextAdjustmentNotes);

  return hasScore && hasTargetScore && hasSummaryNotes;
};

export const getRoastTrainingReadiness = (
  batch: Pick<RoastBatchRecord, 'evaluation' | 'greenBeanId' | 'greenBeanName' | 'roastLevel' | 'roastPlanId' | 'roastPlanName'>,
  hasCurve: boolean,
): RoastTrainingReadinessSummary => {
  const roastPlanName = batch.roastPlanName?.trim() ?? '';
  const roastLevel = batch.roastLevel.trim();

  const items: RoastTrainingReadinessItem[] = [
    {
      detail: hasText(batch.greenBeanName) ? batch.greenBeanName : '需要选择并保存生豆',
      key: 'bean',
      label: '生豆信息',
      ready: hasText(batch.greenBeanId) && hasText(batch.greenBeanName),
    },
    {
      detail: roastPlanName || '需要关联烘焙计划',
      key: 'roastPlan',
      label: '烘焙计划',
      ready: hasText(batch.roastPlanId) || hasText(batch.roastPlanName),
    },
    {
      detail: roastLevel || '需要明确目标烘焙度或风味方向',
      key: 'target',
      label: '目标条件',
      ready: hasText(batch.roastLevel),
    },
    {
      detail: hasCurve ? '已绑定曲线 JSON' : '需要导入 HiBean 或 Artisan 曲线 JSON',
      key: 'curve',
      label: '曲线数据',
      ready: hasCurve,
    },
    {
      detail: isRoastEvaluationReady(batch.evaluation)
        ? '评分与复盘信息已填写'
        : '需要补全评分与至少一项复盘内容',
      key: 'evaluation',
      label: '评价表单',
      ready: isRoastEvaluationReady(batch.evaluation),
    },
  ];

  const completionCount = items.filter((item) => item.ready).length;
  const missingLabels = items.filter((item) => !item.ready).map((item) => item.label);

  return {
    completionCount,
    isUploadReady: missingLabels.length === 0,
    items,
    missingLabels,
  };
};
