import SaveOutlined from '@ant-design/icons/SaveOutlined';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { useRoastPlans } from '@/modules/roast/hooks';
import { getRoastLevelSuggestion, normalizeRoastLevel } from '@/modules/roast/constants/roastLevel';
import type { RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import { createDefaultRoastBatchEvaluation } from '@/modules/roast/services/roast-batch/roastBatch.service.shared';
import { ReadonlyFieldSectionList } from '@/shared/components/ReadonlyFieldSectionList';

import {
  RoastBatchForm,
  type RoastBatchFormState,
  type RoastBatchFormSubmitValue,
} from './RoastBatchForm';
import { RoastCurvePanel } from './RoastCurvePanel';
import { RoastTrainingUploadSection } from './RoastTrainingUploadSection';
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
  soldUnitCount: batch?.soldUnitCount ?? 1,
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
  const [form, setForm] = useState<RoastBatchFormState>(() => createFormState(batch));

  useEffect(() => {
    setForm(createFormState(batch));
  }, [batch]);

  if (!batch) return null;

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
        <RoastTrainingUploadSection batch={batch} />
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
          <ReadonlyFieldSectionList
            sections={[
              {
                key: 'basic',
                items: [
                  { key: 'roastDate', label: '烘焙日期', value: formatRoastDate(batch.roastDate) },
                  { key: 'roastLevel', label: '烘焙程度', value: normalizeRoastLevel(batch.roastLevel) },
                ],
              },
            ]}
          />
        </section>

        <section className={styles.section}>
          <h4>生豆信息</h4>
          <ReadonlyFieldSectionList
            sections={[
              {
                key: 'bean',
                items: [
                  { key: 'greenBeanName', label: '生豆', value: batch.greenBeanName },
                  { key: 'roastedBeanName', label: '熟豆名称', value: batch.roastedBeanName ?? batch.greenBeanName },
                  { key: 'salesMode', label: '去向', value: batch.salesMode === 'selfUse' ? '自留' : '销售' },
                  ...(batch.salesMode === 'sale'
                    ? [
                        {
                          key: 'soldUnitCount',
                          label: '已售份数',
                          value: `${String(batch.soldUnitCount ?? 1)} 份`,
                        },
                        {
                          key: 'finalSaleUnitPrice',
                          label: '本次最终定价',
                          value: formatOptionalCurrency(batch.finalSaleUnitPrice),
                        },
                      ]
                    : []),
                  { key: 'roastPlanName', label: '烘焙计划', value: formatOptionalText(batch.roastPlanName, '未关联') },
                ],
              },
            ]}
          />
        </section>

        <section className={styles.section}>
          <h4>烘焙数据</h4>
          <ReadonlyFieldSectionList
            sections={[
              {
                key: 'metrics',
                items: [
                  { key: 'inputWeightGrams', label: '入豆量', value: `${String(batch.inputWeightGrams)} g` },
                  { key: 'outputWeightGrams', label: '出豆量', value: `${String(batch.outputWeightGrams)} g` },
                  { key: 'lossRate', label: '失水率', value: `${lossRate}%` },
                  { key: 'developmentRatio', label: '发展比', value: `${String(batch.developmentRatio ?? '-')}%` },
                  { key: 'firstCrackTime', label: '一爆时间', value: `${String(batch.firstCrackTime ?? '-')} s` },
                  { key: 'totalRoastTime', label: '总烘焙时间', value: `${String(batch.totalRoastTime ?? '-')} s` },
                ],
              },
            ]}
          />
        </section>

        <section className={styles.section}>
          <h4>评价表单</h4>
          <ReadonlyFieldSectionList
            sections={[
              {
                key: 'evaluation',
                items: [
                  { key: 'overallScore', label: '综合评分', value: batch.evaluation.overallScore ?? '-' },
                  { key: 'targetMatchScore', label: '目标达成度', value: batch.evaluation.targetMatchScore ?? '-' },
                  {
                    key: 'flavorNotes',
                    label: '风味描述',
                    multiline: true,
                    value: formatOptionalText(batch.evaluation.flavorNotes, '暂无记录'),
                  },
                  {
                    key: 'defectNotes',
                    label: '缺陷记录',
                    multiline: true,
                    value: formatOptionalText(batch.evaluation.defectNotes, '暂无记录'),
                  },
                  {
                    key: 'nextAdjustmentNotes',
                    label: '下次调整建议',
                    multiline: true,
                    value: formatOptionalText(batch.evaluation.nextAdjustmentNotes, '暂无记录'),
                  },
                  { key: 'allowTraining', label: '训练授权', value: batch.evaluation.allowTraining ? '已授权' : '未授权' },
                ],
              },
            ]}
          />
        </section>

        <section className={styles.section}>
          <h4>备注</h4>
          <ReadonlyFieldSectionList
            sections={[
              {
                key: 'notes',
                items: [
                  {
                    key: 'notesContent',
                    label: '内容',
                    multiline: true,
                    value: formatOptionalText(batch.notes, '暂无备注'),
                  },
                ],
              },
            ]}
          />
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
        <RoastTrainingUploadSection batch={batch} />
      </div>
    </div>
  );
}
