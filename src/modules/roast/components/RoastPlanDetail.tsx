import { useMemo } from 'react';

import { roastPlanStatusLabelMap } from '@/modules/roast/constants/roastPlanStatus';
import { roastPlanToJsonInput } from '@/modules/roast/services/roastPlanJson.service';
import { ReadonlyFieldSectionList } from '@/shared/components/ReadonlyFieldSectionList';
import type { RoastPlan } from '@/types/domain';

import type { RoastPlanJsonInput } from '../types';

import { RoastPlanForm } from './RoastPlanForm';

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
    const summarySections = [
      {
        key: 'summary',
        title: '计划概览',
        items: [
          { key: 'name', label: '计划名称', value: plan.name },
          { key: 'roasterModel', label: '烘豆机型号', value: plan.roasterModel || '-' },
          { key: 'batchWeightGrams', label: '批次重量', value: `${String(plan.batchWeightGrams)} g` },
          { key: 'targetRoastLevel', label: '烘焙目标', value: plan.targetRoastLevel },
          { key: 'roastPurpose', label: '用途', value: plan.roastPurpose || '-' },
          { key: 'status', label: '状态', value: roastPlanStatusLabelMap[plan.status] },
        ],
      },
    ];
    const stepSections = plan.steps.map((step, index) => ({
      key: `step-${String(step.id)}`,
      title: `节点 ${String(index + 1)}`,
      items: [
        { key: `time-${String(step.id)}`, label: '时间', value: step.timeLabel || '-' },
        { key: `event-${String(step.id)}`, label: '事件', value: step.eventName || '-' },
        { key: `operation-${String(step.id)}`, label: '操作', value: step.operation || '-' },
        { key: `drumTemperature-${String(step.id)}`, label: '炉温', value: step.drumTemperature || '-' },
        { key: `airTemperature-${String(step.id)}`, label: '风温', value: step.airTemperature || '-' },
        { key: `firePower-${String(step.id)}`, label: '火力', value: step.firePower || '-' },
        { key: `drumSpeed-${String(step.id)}`, label: '转速', value: step.drumSpeed || '-' },
      ],
    }));

    return (
      <section className="grid gap-3">
        <ReadonlyFieldSectionList sections={summarySections} />

        <section className="grid gap-2">
          <h3 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-tertiary)]">
            烘焙节点
          </h3>
          <ReadonlyFieldSectionList sections={stepSections} />
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
