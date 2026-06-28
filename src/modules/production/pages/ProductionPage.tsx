import { ApartmentOutlined, CheckCircleOutlined, InboxOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Button, Descriptions, Empty, InputNumber, Select, Space, Tag } from 'antd';
import { useMemo, useState } from 'react';

import { RoastPlanStepTable } from '@/modules/roast/components';
import { useRoastPlanStore } from '@/modules/roast/store';

import styles from './ProductionPage.module.css';

export function ProductionPage() {
  const { plans, selectedPlanId } = useRoastPlanStore();
  const [productionPlanId, setProductionPlanId] = useState(selectedPlanId);
  const [packageSpec, setPackageSpec] = useState('200g 袋装');
  const [plannedOutput, setPlannedOutput] = useState(120);

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.id === productionPlanId) ?? plans[0];
  }, [plans, productionPlanId]);

  const planOptions = plans.map((plan) => ({
    label: `${plan.name} · ${String(plan.batchWeightGrams)}g · ${plan.targetRoastLevel}`,
    value: plan.id,
  }));

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <Tag color="green">Production</Tag>
          <h1>生产批次</h1>
          <p>创建生产任务时先选择烘焙计划，现场可按计划节点执行并记录包装与产出。</p>
        </div>
        <Button icon={<PlayCircleOutlined />} type="primary">
          创建生产批次
        </Button>
      </section>

      <section className={styles.metricGrid} aria-label="生产概览">
        <article className={styles.metricCard} data-tone="green">
          <span>可选计划</span>
          <strong>{plans.length}</strong>
        </article>
        <article className={styles.metricCard} data-tone="blue">
          <span>包装规格</span>
          <strong>{packageSpec}</strong>
        </article>
        <article className={styles.metricCard} data-tone="amber">
          <span>计划产出</span>
          <strong>{plannedOutput} 袋</strong>
        </article>
        <article className={styles.metricCard} data-tone="red">
          <span>执行状态</span>
          <strong>待开始</strong>
        </article>
      </section>

      {selectedPlan ? (
        <section className={styles.workspace}>
          <section className={styles.setupPanel}>
            <div className={styles.sectionTitle}>
              <span>
                <ApartmentOutlined />
                Batch Setup
              </span>
              <h2>生产准备</h2>
            </div>

            <label className={styles.field}>
              <span>选择烘焙计划</span>
              <Select
                options={planOptions}
                onChange={(value: number) => {
                  setProductionPlanId(value);
                }}
                value={selectedPlan.id}
              />
            </label>

            <label className={styles.field}>
              <span>包装规格</span>
              <Select
                options={[
                  { label: '100g 袋装', value: '100g 袋装' },
                  { label: '200g 袋装', value: '200g 袋装' },
                  { label: '500g 袋装', value: '500g 袋装' },
                  { label: '1kg 商用装', value: '1kg 商用装' },
                ]}
                onChange={(value: string) => {
                  setPackageSpec(value);
                }}
                value={packageSpec}
              />
            </label>

            <label className={styles.field}>
              <span>计划产出</span>
              <InputNumber
                min={1}
                onChange={(value) => {
                  setPlannedOutput(value ?? 1);
                }}
                precision={0}
                value={plannedOutput}
              />
            </label>

            <Space wrap>
              <Button icon={<CheckCircleOutlined />} type="primary">
                确认使用计划
              </Button>
              <Button>保存草稿</Button>
            </Space>
          </section>

          <section className={styles.planPanel}>
            <div className={styles.planHeader}>
              <div>
                <Tag color="blue">Selected Plan</Tag>
                <h2>{selectedPlan.name}</h2>
              </div>
            </div>
            <Descriptions
              column={{ xs: 1, sm: 2, lg: 4 }}
              items={[
                {
                  key: 'bean',
                  label: (
                    <span>
                      <InboxOutlined /> 生豆
                    </span>
                  ),
                  children: selectedPlan.beanName,
                },
                {
                  key: 'weight',
                  label: '批次重量',
                  children: `${String(selectedPlan.batchWeightGrams)}g`,
                },
                {
                  key: 'level',
                  label: '目标',
                  children: selectedPlan.targetRoastLevel,
                },
                {
                  key: 'steps',
                  label: '节点',
                  children: `${String(selectedPlan.steps.length)} 个`,
                },
              ]}
              size="small"
            />
            <RoastPlanStepTable steps={selectedPlan.steps} />
          </section>
        </section>
      ) : (
        <Empty description="暂无可用于生产的烘焙计划" />
      )}
    </main>
  );
}
