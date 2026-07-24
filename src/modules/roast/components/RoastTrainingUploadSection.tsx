import App from 'antd/es/app';
import Button from 'antd/es/button';
import Checkbox from 'antd/es/checkbox';
import { useState } from 'react';

import { useCreateRoastPlan, useRoastAiUsage, useRoastCurve } from '@/modules/roast/hooks';
import {
  useConfirmRoastTrainingRecommendation,
  useRoastTrainingUpload,
  useRoastTrainingUploadStatus,
} from '@/modules/roast/hooks/useRoastTrainingUpload';
import { formatRoastAiUsageText, isRoastAiUsageAvailable } from '@/modules/roast/services/roastAiUsage.service';
import { isRoastTrainingUploadClientEnabled } from '@/modules/roast/services/roastTrainingUpload.service';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { RoastTrainingRecommendation } from '@/modules/roast/types/roastTraining';
import type { RoastPlanJsonInput } from '@/modules/roast/types';
import { getRoastTrainingReadiness } from '@/modules/roast/utils/roastTrainingReadiness';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './RoastBatchDrawer.module.css';
import { RoastPlanForm } from './RoastPlanForm';

interface RoastTrainingUploadSectionProps {
  batch: RoastBatchRecord;
  evaluation?: RoastBatchRecord['evaluation'];
  onEvaluationChange?: (evaluation: RoastBatchRecord['evaluation']) => void;
}

const priorityLabels: Record<RoastTrainingRecommendation['adjustments'][number]['priority'], string> = {
  high: '高优先级',
  low: '低优先级',
  medium: '中优先级',
};

const getAdjustmentRationale = (adjustment: RoastTrainingRecommendation['adjustments'][number]): string => {
  const rationale = adjustment.rationale?.trim();

  return rationale != null && rationale.length > 0
    ? rationale
    : adjustment.observation || '基于当前曲线、评价表单和目标条件综合判断。';
};

const getAdjustmentExpectedResult = (adjustment: RoastTrainingRecommendation['adjustments'][number]): string => {
  const expectedResult = adjustment.expectedResult?.trim();

  return expectedResult != null && expectedResult.length > 0
    ? expectedResult
    : '预计让下一炉更接近目标风味，实际结果需结合下一炉曲线与杯测验证。';
};

function RoastTrainingUploadSectionContent({ batch, evaluation, onEvaluationChange }: RoastTrainingUploadSectionProps) {
  const { message, modal } = App.useApp();
  const [editingRecommendation, setEditingRecommendation] = useState<RoastTrainingRecommendation | null>(null);
  const roastCurveQuery = useRoastCurve(batch.id);
  const usageQuery = useRoastAiUsage('roast_training_recommendation');
  const trainingUploadStatusQuery = useRoastTrainingUploadStatus(batch.id);
  const trainingUploadMutation = useRoastTrainingUpload();
  const createPlanMutation = useCreateRoastPlan();
  const confirmRecommendationMutation = useConfirmRoastTrainingRecommendation(batch.id);
  const isTrainingUploadClientEnabled = isRoastTrainingUploadClientEnabled();
  const isEditable = onEvaluationChange != null;
  const readinessSubject = isEditable ? '当前表单' : '当前记录';
  const effectiveEvaluation = evaluation ?? batch.evaluation;
  const effectiveBatch = {
    ...batch,
    evaluation: effectiveEvaluation,
  };
  const trainingReadiness = getRoastTrainingReadiness(effectiveBatch, Boolean(roastCurveQuery.data));
  const serverUploadStatus = trainingUploadStatusQuery.data;
  const recommendation = serverUploadStatus?.recommendation ?? trainingUploadMutation.data?.recommendation;
  const hasRecommendation = recommendation != null;
  const usageErrorText = usageQuery.error instanceof Error ? usageQuery.error.message : '';
  const usageText = formatRoastAiUsageText(usageQuery.data, {
    error: usageErrorText,
    isLoading: usageQuery.isLoading,
  });
  const canUseQuota = isRoastAiUsageAvailable(usageQuery.data);
  const trainingUploadError =
    trainingUploadStatusQuery.error instanceof Error ? trainingUploadStatusQuery.error.message : '';
  const trainingUploadSubmitError =
    trainingUploadMutation.error instanceof Error ? trainingUploadMutation.error.message : '';
  const isAlreadyUploaded = serverUploadStatus?.alreadyUploaded === true;
  const missingReadyLabels = trainingReadiness.missingLabels;
  const isTrainingDataReady = trainingReadiness.missingLabels.length === 0;
  const isTrainingFormReady = isTrainingDataReady;
  const canFallbackToServerValidation =
    isTrainingUploadClientEnabled &&
    trainingUploadStatusQuery.isError &&
    isTrainingFormReady;
  const isTrainingUploadEnabled =
    isTrainingUploadClientEnabled &&
    isTrainingFormReady &&
    canUseQuota &&
    (serverUploadStatus?.enabled === true || canFallbackToServerValidation);
  const trainingUploadButtonLabel = '生成整体复盘与计划建议';
  const trainingHintText = trainingUploadSubmitError
      ? trainingUploadSubmitError
      : trainingUploadError && canFallbackToServerValidation
        ? '状态查询暂未刷新，可直接点击上传，服务端会做最终校验。'
        : trainingUploadError
          ? trainingUploadError
        : hasRecommendation || isAlreadyUploaded
          ? '这条记录已经生成过整体复盘与计划建议，不能重复生成。'
          : !canUseQuota
            ? '本月整体复盘与计划建议额度不足或暂不可用。'
          : !isTrainingFormReady
            ? `当前仍缺少：${missingReadyLabels.join('、')}。`
            : serverUploadStatus?.enabled === true
              ? '将结合计划、曲线和杯测评价做整体复盘，并保存一份可编辑的新计划草稿。'
              : '当前表单已满足要求，请先保存烘焙记录后再生成。';
  const trainingSummaryText = isTrainingFormReady
    ? `${readinessSubject}已满足整体复盘与计划建议生成条件。`
    : `当前仍缺少：${missingReadyLabels.join('、')}。`;

  const handleTrainingUpload = () => {
    modal.confirm({
      cancelText: '取消',
      content: '本次会读取当前烘焙记录、生豆、烘焙计划、曲线、评价表单和烘焙机参数，分析导致杯测结果的可能原因、曲线特征和优化策略，并生成一份可编辑的新计划草稿。同一条烘焙记录不能重复生成。',
      okButtonProps: {
        danger: true,
      },
      okText: '确认生成',
      title: '确认生成整体复盘',
      onOk: async () => {
        try {
          await trainingUploadMutation.mutateAsync(batch.id);
          void message.success('整体复盘与计划建议已生成。');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '整体复盘生成失败，请稍后重试。';
          void message.error(errorMessage);
          throw error;
        }
      },
    });
  };

  const handleCreatePlanFromRecommendation = async (input: RoastPlanJsonInput) => {
    if (!editingRecommendation) {
      return;
    }

    try {
      const createdPlan = await createPlanMutation.mutateAsync(input);
      await confirmRecommendationMutation.mutateAsync({
        confirmedPlanId: String(createdPlan.id),
        recommendationId: editingRecommendation.recommendationId,
      });
      setEditingRecommendation(null);
      void message.success('已根据 AI 建议创建新的烘焙计划。');
    } catch (error: unknown) {
      void message.error(getUserFacingErrorMessage(error, 'AI 建议计划创建失败，请检查后重试。'));
    }
  };

  const planDraft = recommendation?.modifiedPlanJson;

  return (
    <>
      <section className={styles.section}>
        {recommendation ? (
          <>
            <h4>AI 整体复盘与计划建议</h4>
            <article className={styles.reviewCard}>
              <div className={styles.reviewCardHeader}>
                <strong>整体详细复盘</strong>
                <span>置信度 {String(recommendation.confidence)}%</span>
              </div>
              <p>{recommendation.overallReview}</p>
            </article>
            {recommendation.adjustments.length > 0 ? (
              <div className={styles.recommendationStack}>
                <h5>调整原因、建议与预计结果</h5>
                {recommendation.adjustments.map((adjustment, index) => (
                  <article className={styles.adjustmentCard} key={`${adjustment.area}-${adjustment.suggestion}`}>
                    <div className={styles.reviewCardHeader}>
                      <strong>{String(index + 1)}. {adjustment.area}</strong>
                      <span>{priorityLabels[adjustment.priority]}</span>
                    </div>
                    <dl>
                      <div>
                        <dt>当前观察</dt>
                        <dd>{adjustment.observation}</dd>
                      </div>
                      <div>
                        <dt>调整原因</dt>
                        <dd>{getAdjustmentRationale(adjustment)}</dd>
                      </div>
                      <div>
                        <dt>调整建议</dt>
                        <dd>{adjustment.suggestion}</dd>
                      </div>
                      <div>
                        <dt>预计结果</dt>
                        <dd>{getAdjustmentExpectedResult(adjustment)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : null}
            {planDraft ? (
              <div className={styles.planDraftPanel}>
                <div className={styles.reviewCardHeader}>
                  <strong>优化后的烘焙计划</strong>
                  <span>{recommendation.status === 'confirmed' ? '已确认使用' : '待确认使用'}</span>
                </div>
                <div className={styles.planDraftMeta}>
                  <span>{planDraft.name}</span>
                  <span>{planDraft.beanName}</span>
                  <span>{planDraft.roasterModel}</span>
                  <span>{String(planDraft.batchWeightGrams)} g</span>
                  <span>{planDraft.roastLevel}</span>
                  {planDraft.purpose ? <span>{planDraft.purpose}</span> : null}
                </div>
                <div className={styles.planStepList}>
                  {planDraft.steps.map((step, index) => (
                    <article className={styles.planStepCard} key={`${step.time}-${step.event}-${String(index)}`}>
                      <strong>{step.time} · {step.event}</strong>
                      <p>{step.operation}</p>
                      <span>
                        豆温 {step.temperature || '-'} / 风温 {step.airTemperature || '-'} / 火力{' '}
                        {step.firePower || '-'} / 转速 {step.drumSpeed || '-'}
                      </span>
                      {step.note ? <p>{step.note}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <h4>AI 训练准备</h4>
            <p className={styles.trainingSummary}>{trainingSummaryText}</p>
            <div className={styles.trainingGrid}>
              {trainingReadiness.items.map((item) => (
                <article className={styles.trainingItem} data-ready={item.ready ? 'true' : 'false'} key={item.key}>
                  <strong>{item.label}</strong>
                  <span>{item.ready ? '已就绪' : '待补充'}</span>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </>
        )}
        <div className={styles.trainingActionRow}>
          {!hasRecommendation && !isAlreadyUploaded ? (
            <div className={styles.consentCard}>
              <strong>训练授权</strong>
              {onEvaluationChange ? (
                <Checkbox
                  checked={effectiveEvaluation.allowTraining}
                  onChange={(event) => {
                    onEvaluationChange({
                      ...effectiveEvaluation,
                      allowTraining: event.target.checked,
                    });
                  }}
                >
                  允许将本次匿名烘焙数据用于同型号模型训练
                </Checkbox>
              ) : (
                <span className={styles.consentState}>{effectiveEvaluation.allowTraining ? '已授权' : '未授权'}</span>
              )}
              <p>默认关闭。未授权仍可生成本人的复盘与计划建议，但不会用于同型号公共模型训练。</p>
            </div>
          ) : null}
          {!hasRecommendation && !isAlreadyUploaded ? (
            <Button
              disabled={!isTrainingUploadEnabled || trainingUploadMutation.isPending}
              loading={trainingUploadStatusQuery.isFetching || trainingUploadMutation.isPending || usageQuery.isLoading}
              onClick={handleTrainingUpload}
              type="default"
            >
              {trainingUploadButtonLabel}
            </Button>
          ) : null}
          {!hasRecommendation && !isAlreadyUploaded ? <span className={styles.trainingHint}>{usageText}</span> : null}
          {recommendation && recommendation.status !== 'confirmed' ? (
            <Button
              loading={createPlanMutation.isPending || confirmRecommendationMutation.isPending}
              onClick={() => {
                setEditingRecommendation(recommendation);
              }}
              type="primary"
            >
              确认使用修改后的计划
            </Button>
          ) : null}
          <span className={styles.trainingHint}>{trainingHintText}</span>
        </div>
      </section>
      <AppDrawer
        className={styles.planCreationDrawer}
        height="86dvh"
        onClose={() => {
          setEditingRecommendation(null);
        }}
        open={editingRecommendation != null}
        placement="bottom"
        title="确认 AI 建议计划"
      >
        {editingRecommendation ? (
          <RoastPlanForm
            initialValues={editingRecommendation.modifiedPlanJson}
            onCancel={() => {
              setEditingRecommendation(null);
            }}
            onSubmit={handleCreatePlanFromRecommendation}
            submitLabel="创建为新烘焙计划"
          />
        ) : null}
      </AppDrawer>
    </>
  );
}

export function RoastTrainingUploadSection(props: RoastTrainingUploadSectionProps) {
  return <RoastTrainingUploadSectionContent {...props} />;
}
