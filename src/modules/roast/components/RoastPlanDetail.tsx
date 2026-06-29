import { DeleteOutlined } from '@ant-design/icons';
import { App, Button, Popconfirm } from 'antd';
import { useMemo } from 'react';

import { roastPlanToJsonInput } from '@/modules/roast/services/roastPlanJson.service';
import { AppError } from '@/shared/errors/AppError';
import type { RoastPlan } from '@/types/domain';

import type { RoastPlanJsonInput } from '../types';

import { RoastPlanForm } from './RoastPlanForm';
import styles from './RoastPlanDetail.module.css';

interface RoastPlanDetailProps {
  mode: 'view' | 'edit';
  onDelete: (planId: RoastPlan['id']) => Promise<void> | void;
  onUpdate: (planId: RoastPlan['id'], input: RoastPlanJsonInput) => Promise<void> | void;
  plan: RoastPlan;
}

export function RoastPlanDetail({ mode, onDelete, onUpdate, plan }: RoastPlanDetailProps) {
  const { message } = App.useApp();
  const initialValues = useMemo(() => roastPlanToJsonInput(plan), [plan]);

  const handleSubmit = async (input: RoastPlanJsonInput) => {
    try {
      await onUpdate(plan.id, input);
      void message.success('烘焙计划已保存');
    } catch (error) {
      const errorMessage = error instanceof AppError ? error.message : '保存失败，请检查表单内容。';
      void message.error(errorMessage);
    }
  };

  if (mode === 'view') {
    const summaryItems = [
      { label: '计划名称', value: plan.name },
      { label: '批次重量', value: `${String(plan.batchWeightGrams)}g` },
      { label: '烘焙目标', value: plan.targetRoastLevel },
      { label: '用途', value: plan.roastPurpose || '-' },
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
    <section className={styles.panel}>
      <RoastPlanForm initialValues={initialValues} onSubmit={handleSubmit} submitLabel="保存计划" />
      <div className={styles.dangerZone}>
        <Popconfirm
          cancelText="取消"
          okText="删除"
          okButtonProps={{ danger: true }}
          onConfirm={async () => {
            await onDelete(plan.id);
          }}
          title="删除这个烘焙计划？"
        >
          <Button aria-label="删除计划" block danger icon={<DeleteOutlined />}>
            删除计划
          </Button>
        </Popconfirm>
      </div>
    </section>
  );
}
