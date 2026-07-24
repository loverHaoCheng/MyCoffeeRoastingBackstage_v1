import { Select } from '@/components/ui/select';
import Input from '@/shared/components/ui/input';
import type { RoastBatchEvaluation } from '@/modules/roast/types/roastBatch';

import styles from './RoastBatchForm.module.css';

interface RoastEvaluationEditorProps {
  evaluation: RoastBatchEvaluation;
  onChange: (evaluation: RoastBatchEvaluation) => void;
}

const SCORE_OPTIONS = [
  { label: '1 分', value: 1 },
  { label: '2 分', value: 2 },
  { label: '3 分', value: 3 },
  { label: '4 分', value: 4 },
  { label: '5 分', value: 5 },
];

export function RoastEvaluationEditor({ evaluation, onChange }: RoastEvaluationEditorProps) {
  return (
    <div className={styles.fieldGrid}>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>综合评分</span>
        <Select
          allowClear
          aria-label="综合评分"
          options={SCORE_OPTIONS}
          placeholder="选择 1-5 分"
          showSearch={false}
          value={evaluation.overallScore}
          onChange={(overallScore) => {
            onChange({ ...evaluation, overallScore });
          }}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>目标达成度</span>
        <Select
          allowClear
          aria-label="目标达成度"
          options={SCORE_OPTIONS}
          placeholder="选择 1-5 分"
          showSearch={false}
          value={evaluation.targetMatchScore}
          onChange={(targetMatchScore) => {
            onChange({ ...evaluation, targetMatchScore });
          }}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>风味描述</span>
        <Input.TextArea
          aria-label="风味描述"
          placeholder="记录杯测印象、甜感、酸质、醇厚度等"
          rows={3}
          value={evaluation.flavorNotes ?? ''}
          onChange={(event) => {
            onChange({ ...evaluation, flavorNotes: event.target.value });
          }}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>缺陷记录</span>
        <Input.TextArea
          aria-label="缺陷记录"
          placeholder="例如 烟感偏重、发展不足、风味发木"
          rows={3}
          value={evaluation.defectNotes ?? ''}
          onChange={(event) => {
            onChange({ ...evaluation, defectNotes: event.target.value });
          }}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>下次调整建议</span>
        <Input.TextArea
          aria-label="下次调整建议"
          placeholder="例如 一爆前减火提前 20 秒，后段风门再开 5%"
          rows={3}
          value={evaluation.nextAdjustmentNotes ?? ''}
          onChange={(event) => {
            onChange({ ...evaluation, nextAdjustmentNotes: event.target.value });
          }}
        />
      </div>
    </div>
  );
}
