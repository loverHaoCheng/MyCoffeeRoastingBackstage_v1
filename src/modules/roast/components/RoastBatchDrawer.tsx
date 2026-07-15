import SaveOutlined from '@ant-design/icons/SaveOutlined';
import Button from 'antd/es/button';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { useRoastCurve, useRoastPlans } from '@/modules/roast/hooks';
import { getRoastLevelSuggestion, normalizeRoastLevel } from '@/modules/roast/constants/roastLevel';
import type { RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import { createDefaultRoastBatchEvaluation } from '@/modules/roast/services/roast-batch/roastBatch.service.shared';
import { getRoastTrainingReadiness } from '@/modules/roast/utils/roastTrainingReadiness';

import {
  RoastBatchForm,
  type RoastBatchFormState,
  type RoastBatchFormSubmitValue,
} from './RoastBatchForm';
import { RoastCurvePanel } from './RoastCurvePanel';
import styles from './RoastBatchDrawer.module.css';

type DrawerMode = 'view' | 'edit';

const ROAST_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm';

interface RoastBatchDrawerProps {
  batch: RoastBatchRecord | null;
  mode: DrawerMode;
  onClose: () => void;
  onUpdate?: (batchId: string, input: RoastBatchUpdateInput) => Promise<void> | void;
}

const createFormState = (batch: RoastBatchRecord | null): RoastBatchFormState => ({
  evaluation: batch?.evaluation ?? createDefaultRoastBatchEvaluation(),
  developmentRatio: batch?.developmentRatio,
  firstCrackTime: batch?.firstCrackTime,
  finalSaleUnitPrice: batch?.finalSaleUnitPrice ?? undefined,
  greenBeanId: batch?.greenBeanId ?? '',
  greenBeanName: batch?.greenBeanName ?? '',
  inputWeightGrams: batch?.inputWeightGrams ?? 0,
  notes: batch?.notes ?? '',
  outputWeightGrams: batch?.outputWeightGrams ?? 0,
  roastDate: batch?.roastDate ?? '',
  roastLevel: batch ? normalizeRoastLevel(batch.roastLevel) : getRoastLevelSuggestion(0, 0),
  roastPlanId: batch?.roastPlanId ?? '',
  roastPlanName: batch?.roastPlanName ?? '',
  roastedBeanName: batch?.roastedBeanName ?? '',
  salesMode: batch?.salesMode ?? 'sale',
  totalRoastTime: batch?.totalRoastTime,
});

const formatRoastDate = (value: string): string => {
  const parsed = dayjs(value);

  return parsed.isValid() ? parsed.format(ROAST_DATE_TIME_FORMAT) : value;
};

const formatOptionalText = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();

  return trimmed != null && trimmed.length > 0 ? trimmed : fallback;
};

const formatOptionalCurrency = (value: number | null | undefined): string => {
  return value != null && Number.isFinite(value) ? `¥${value.toFixed(2)}` : '-';
};

export function RoastBatchDrawer({ batch, mode, onClose, onUpdate }: RoastBatchDrawerProps) {
  const { data: beans = [] } = useBeans();
  const { data: plans = [] } = useRoastPlans();
  const roastCurveQuery = useRoastCurve(batch?.id);
  const [form, setForm] = useState<RoastBatchFormState>(() => createFormState(batch));

  useEffect(() => {
    setForm(createFormState(batch));
  }, [batch]);

  if (!batch) return null;

  const trainingReadiness = getRoastTrainingReadiness(batch, Boolean(roastCurveQuery.data));
  const trainingSummaryText = trainingReadiness.isUploadReady
    ? '当前记录已满足后续训练上传条件；正式上传入口会在后续版本开放。'
    : `当前仍缺少：${trainingReadiness.missingLabels.join('、')}。`;

  const trainingSection = (
    <section className={styles.section}>
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
      <div className={styles.trainingActionRow}>
        <Button disabled type="default">
          上传用于训练（暂未开放）
        </Button>
        <span className={styles.trainingHint}>当前版本先完成数据采集与校验，上传与 AI 推荐会在后续阶段开放。</span>
      </div>
    </section>
  );

  if (mode === 'edit') {
    const handleSubmit = (submitValue: RoastBatchFormSubmitValue) => {
      if (!onUpdate) return;

      const updateInput: RoastBatchUpdateInput = {
        ...submitValue,
      };

      onClose();
      void onUpdate(batch.id, updateInput);
    };

    return (
      <div className={styles.drawer}>
        <RoastBatchForm
          beans={beans}
          curveSection={<RoastCurvePanel batch={batch} />}
          onCancel={onClose}
          onChange={setForm}
          onSubmit={handleSubmit}
          plans={plans}
          resetKey={batch.id}
          submitIcon={<SaveOutlined />}
          submitLabel="保存烘焙记录"
          value={form}
        />
        {trainingSection}
      </div>
    );
  }

  const lossRate = batch.inputWeightGrams > 0
    ? (((batch.inputWeightGrams - batch.outputWeightGrams) / batch.inputWeightGrams) * 100).toFixed(1)
    : '-';

  return (
    <div className={styles.drawer}>
      <div className={styles.body}>
        <section className={styles.section}>
          <h4>基本信息</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>烘焙日期</span>
              <span className={styles.fieldValue}>{formatRoastDate(batch.roastDate)}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>烘焙程度</span>
              <span className={styles.fieldValue}>{normalizeRoastLevel(batch.roastLevel)}</span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h4>生豆信息</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>生豆</span>
              <span className={styles.fieldValue}>{batch.greenBeanName}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>熟豆名称</span>
              <span className={styles.fieldValue}>{batch.roastedBeanName ?? batch.greenBeanName}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>去向</span>
              <span className={styles.fieldValue}>{batch.salesMode === 'selfUse' ? '自留' : '销售'}</span>
            </div>
            {batch.salesMode === 'sale' ? (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>本次最终定价</span>
                <span className={styles.fieldValue}>{formatOptionalCurrency(batch.finalSaleUnitPrice)}</span>
              </div>
            ) : null}
            <div className={styles.field}>
              <span className={styles.fieldLabel}>烘焙计划</span>
              <span className={styles.fieldValue}>{formatOptionalText(batch.roastPlanName, '未关联')}</span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h4>烘焙数据</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>入豆量 (g)</span>
              <span className={styles.fieldValue}>{batch.inputWeightGrams} g</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>出豆量 (g)</span>
              <span className={styles.fieldValue}>{batch.outputWeightGrams} g</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>失水率</span>
              <span className={styles.fieldValue}>{lossRate}%</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>发展比 (%)</span>
              <span className={styles.fieldValue}>{batch.developmentRatio ?? '-'}%</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>一爆时间 (s)</span>
              <span className={styles.fieldValue}>{batch.firstCrackTime ?? '-'} s</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>总烘焙时间 (s)</span>
              <span className={styles.fieldValue}>{batch.totalRoastTime ?? '-'} s</span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h4>评价表单</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>综合评分</span>
              <span className={styles.fieldValue}>{batch.evaluation.overallScore ?? '-'}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>目标达成度</span>
              <span className={styles.fieldValue}>{batch.evaluation.targetMatchScore ?? '-'}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>风味描述</span>
              <span className={styles.fieldValue}>{formatOptionalText(batch.evaluation.flavorNotes, '暂无记录')}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>缺陷记录</span>
              <span className={styles.fieldValue}>{formatOptionalText(batch.evaluation.defectNotes, '暂无记录')}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>下次调整建议</span>
              <span className={styles.fieldValue}>{formatOptionalText(batch.evaluation.nextAdjustmentNotes, '暂无记录')}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>训练授权</span>
              <span className={styles.fieldValue}>{batch.evaluation.allowTraining ? '已授权' : '未授权'}</span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h4>备注</h4>
          <p className={styles.notes}>{batch.notes ?? '暂无备注'}</p>
        </section>

        <section className={styles.section}>
          <RoastCurvePanel batch={batch} />
          {batch.imageUrls?.length ? (
            <div className={styles.imageGrid}>
              {batch.imageUrls.map((url, index) => (
                <div key={url} className={styles.imagePlaceholder}>
                  <img src={url} alt={`烘焙记录图片 ${String(index + 1)}`} />
                </div>
              ))}
            </div>
          ) : null}
        </section>
        {trainingSection}
      </div>
    </div>
  );
}
