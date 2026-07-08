import { useMemo } from 'react';

import { roastPlanStatusLabelMap } from '@/modules/roast/constants/roastPlanStatus';
import { roastPlanToJsonInput } from '@/modules/roast/services/roastPlanJson.service';
import type { RoastPlan } from '@/types/domain';

import type { RoastPlanJsonInput } from '../types';

import { RoastPlanForm } from './RoastPlanForm';
import styles from './RoastPlanDetail.module.css';

interface RoastPlanDetailProps {
  mode: 'view' | 'edit';
  onClose: () => void;
  onUpdate?: (planId: RoastPlan['id'], input: RoastPlanJsonInput) => Promise<void> | void;
  plan: RoastPlan;
}

export function RoastPlanDetail({ mode, onClose, onUpdate, plan }: RoastPlanDetailProps) {
  const initialValues = useMemo(() => roastPlanToJsonInput(plan), [plan]);

  const handleSubmit = (input: RoastPlanJsonInput) => {
    onClose();
    void onUpdate?.(plan.id, input);
  };

  if (mode === 'view') {
    const summaryItems = [
      { label: '计划名称', value: plan.name },
      { label: '批次重量', value: `${String(plan.batchWeightGrams)}g` },
      { label: '烘焙目标', value: plan.targetRoastLevel },
      { label: '用途', value: plan.roastPurpose || '-' },
      { label: '状态', value: roastPlanStatusLabelMap[plan.status] },
    ];

    return (
      <section className={styles.panel}>
        <div className={styles.summaryGrid}>
          {summaryItems.map((item) => (
            <div className={styles.summaryItem} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <section className={styles.readOnlySteps}>
          <h3>烘焙节点</h3>
          <div className={styles.stepList}>
            {plan.steps.map((step, index) => (
              <article className={styles.stepItem} key={step.id}>
                <div className={styles.stepHeading}>
                  <span>节点 {String(index + 1)}</span>
                  <strong>{step.timeLabel || '-'}</strong>
                </div>
                <dl>
                  <div>
                    <dt>事件</dt>
                    <dd>{step.eventName || '-'}</dd>
                  </div>
                  <div>
                    <dt>操作</dt>
                    <dd>{step.operation || '-'}</dd>
                  </div>
                  <div>
                    <dt>炉温</dt>
                    <dd>{step.drumTemperature || '-'}</dd>
                  </div>
                  <div>
                    <dt>火力</dt>
                    <dd>{step.firePower || '-'}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      </section>
    );
  }

  return (
    <RoastPlanForm
      initialValues={initialValues}
      onCancel={onClose}
      onSubmit={handleSubmit}
      submitLabel="保存计划"
    />
  );
}
