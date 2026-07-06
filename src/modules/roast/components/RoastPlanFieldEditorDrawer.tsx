import { App, Input, InputNumber, Select, Spin } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { roastPlanJsonSchema } from '@/modules/roast/schemas/roastPlanJson.schema';
import { roastPlanToJsonInput } from '@/modules/roast/services/roastPlanJson.service';
import { useUpdateRoastPlan } from '@/modules/roast/hooks/useRoastPlans';
import type { RoastPlan } from '@/types/domain';

import type { RoastPlanJsonInput } from '../types';

import { FieldEditorDrawer } from '@/shared/components/FieldEditorDrawer';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';

const GENERIC_BEAN_ID = 'generic';
const GENERIC_BEAN_NAME = '通用';

export type RoastPlanEditableFieldPath = 'batchWeightGrams' | 'beanId' | 'purpose' | 'roastLevel';

interface RoastPlanFieldEditorDrawerProps {
  fieldPath?: RoastPlanEditableFieldPath;
  onClose: () => void;
  open: boolean;
  plan: RoastPlan | null;
  placement?: 'bottom' | 'right';
  width?: number;
  height?: string;
}

const fieldMeta: Record<
  RoastPlanEditableFieldPath,
  {
    label: string;
    placeholder: string;
    type: 'number' | 'select' | 'text';
  }
> = {
  batchWeightGrams: { label: '批次重量', placeholder: '例如 200', type: 'number' },
  beanId: { label: '生豆', placeholder: '选择对应生豆', type: 'select' },
  purpose: { label: '用途', placeholder: '例如 手冲 / 咖啡馆', type: 'text' },
  roastLevel: { label: '烘焙目标', placeholder: '例如 手冲浅烘', type: 'text' },
};

export function RoastPlanFieldEditorDrawer({
  fieldPath,
  height,
  onClose,
  open,
  plan,
  placement,
  width,
}: RoastPlanFieldEditorDrawerProps) {
  const { message } = App.useApp();
  const { data: beans = [], isLoading: beansLoading } = useBeans();
  const updatePlanMutation = useUpdateRoastPlan();
  const [draft, setDraft] = useState<RoastPlanJsonInput | null>(null);

  const editableFieldPath = fieldPath;
  const fieldConfig = editableFieldPath ? fieldMeta[editableFieldPath] : undefined;
  const baseDraft = useMemo(() => (plan ? roastPlanToJsonInput(plan) : null), [plan]);
  const drawerHeight = editableFieldPath === 'beanId' && placement === 'bottom' ? '240px' : height;

  useEffect(() => {
    if (!baseDraft) {
      return;
    }

    setDraft(baseDraft);
  }, [baseDraft, editableFieldPath]);

  if (!open || plan == null || editableFieldPath == null) {
    return null;
  }

  if (!fieldConfig || draft == null) {
    return (
      <AppDrawer
        destroyOnHidden
        height={height}
        onClose={onClose}
        open={open}
        placement={placement}
        title={`修改${fieldConfig?.label ?? '信息'}`}
        width={width}
      >
        <section style={{ display: 'grid', placeItems: 'center', minHeight: '240px' }}>
          <Spin />
        </section>
      </AppDrawer>
    );
  }

  const updateDraft = <K extends RoastPlanEditableFieldPath>(key: K, value: RoastPlanJsonInput[K]) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextDraft: RoastPlanJsonInput = { ...current };
      nextDraft[key] = value;

      if (key === 'beanId') {
        const nextBeanId = value;
        const selectedBean = beans.find((bean) => String(bean.id) === String(nextBeanId));
        nextDraft.beanName =
          String(nextBeanId) === GENERIC_BEAN_ID ? GENERIC_BEAN_NAME : selectedBean?.name ?? nextDraft.beanName;
      }

      return nextDraft;
    });
  };

  const handleSubmit = () => {
    const parsed = roastPlanJsonSchema.safeParse(draft);

    if (!parsed.success) {
      void message.error(parsed.error.issues[0]?.message ?? '保存失败，请检查输入');
      return;
    }

    onClose();
    submissionBackupService.save('update', { input: parsed.data, planId: plan.id }, 'roastPlan');

    const updateTask = updatePlanMutation.mutateAsync({ planId: plan.id, input: parsed.data }).catch(
      (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : '烘焙计划同步失败，本地已备份。';
        void message.error(errorMessage);
      },
    );

    void updateTask;
  };

  const renderField = () => {
    switch (editableFieldPath) {
      case 'batchWeightGrams':
        return (
          <InputNumber
            min={1}
            onChange={(value) => {
              updateDraft('batchWeightGrams', value ?? 0);
            }}
            precision={0}
            suffix="g"
            style={{ width: '100%' }}
            value={draft.batchWeightGrams}
          />
        );
      case 'beanId':
        return (
          <Select
            loading={beansLoading}
            onChange={(value) => {
              const nextBeanId = value;
              updateDraft('beanId', nextBeanId);
            }}
            options={[
              { label: GENERIC_BEAN_NAME, value: GENERIC_BEAN_ID },
              ...beans.map((bean) => ({ label: bean.name, value: String(bean.id) })),
            ]}
            placeholder={fieldConfig.placeholder}
            value={draft.beanId == null ? undefined : String(draft.beanId)}
          />
        );
      case 'purpose':
        return (
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 6 }}
            onChange={(event) => {
              updateDraft('purpose', event.target.value);
            }}
            placeholder={fieldConfig.placeholder}
            value={draft.purpose ?? ''}
          />
        );
      case 'roastLevel':
        return (
          <Input
            onChange={(event) => {
              updateDraft('roastLevel', event.target.value);
            }}
            placeholder={fieldConfig.placeholder}
            value={draft.roastLevel}
          />
        );
    }
  };

  return (
    <FieldEditorDrawer
      height={drawerHeight}
      loadingLabel="保存中"
      onClose={onClose}
      onSubmit={handleSubmit}
      open={open}
      placement={placement}
      submitLabel={editableFieldPath === 'beanId' ? '设置' : `保存${fieldConfig.label}`}
      title={`修改${fieldConfig.label}`}
      width={width}
    >
      <section style={{ display: 'grid', gap: '10px', padding: 0 }}>
        <label style={{ display: 'grid', gap: '6px' }}>
          <span style={{ color: 'var(--app-text-secondary)', fontSize: '12px', fontWeight: 700 }}>{fieldConfig.label}</span>
          {renderField()}
        </label>
      </section>
    </FieldEditorDrawer>
  );
}
