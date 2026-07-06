import { App, DatePicker, Input, InputNumber, Select, Spin } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { useRoastPlans } from '@/modules/roast/hooks';
import { useUpdateRoastBatch } from '@/modules/roast/hooks/useRoastBatches';
import type { RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import { FieldEditorDrawer } from '@/shared/components/FieldEditorDrawer';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';

export type RoastBatchEditableFieldPath =
  | 'developmentRatio'
  | 'firstCrackTime'
  | 'greenBeanId'
  | 'inputWeightGrams'
  | 'notes'
  | 'outputWeightGrams'
  | 'roastDate'
  | 'roastLevel'
  | 'roastPlanId'
  | 'roastedBeanName'
  | 'status'
  | 'totalRoastTime';

interface RoastBatchFieldEditorDrawerProps {
  batch: RoastBatchRecord | null;
  fieldPath?: RoastBatchEditableFieldPath;
  height?: string;
  onClose: () => void;
  open: boolean;
  placement?: 'bottom' | 'right';
  width?: number;
}

const ROAST_LEVELS = ['极浅', '浅焙', '肉桂', '中浅', '中焙', '中深', '深焙', '极深'];
const GENERIC_BEAN_ID = 'generic';

const createDraft = (batch: RoastBatchRecord | null): RoastBatchUpdateInput | null => {
  if (!batch) {
    return null;
  }

  return {
    developmentRatio: batch.developmentRatio,
    firstCrackTime: batch.firstCrackTime,
    greenBeanId: batch.greenBeanId,
    greenBeanName: batch.greenBeanName,
    inputWeightGrams: batch.inputWeightGrams,
    notes: batch.notes,
    outputWeightGrams: batch.outputWeightGrams,
    roastDate: batch.roastDate,
    roastLevel: batch.roastLevel,
    roastPlanId: batch.roastPlanId,
    roastPlanName: batch.roastPlanName,
    roastedBeanName: batch.roastedBeanName,
    status: batch.status,
    totalRoastTime: batch.totalRoastTime,
  };
};

const toPickerValue = (value: string) => {
  if (!value) {
    return null;
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed : null;
};

export function RoastBatchFieldEditorDrawer({
  batch,
  fieldPath,
  height,
  onClose,
  open,
  placement,
  width,
}: RoastBatchFieldEditorDrawerProps) {
  const { message } = App.useApp();
  const { data: beans = [] } = useBeans();
  const { data: plans = [] } = useRoastPlans();
  const updateBatchMutation = useUpdateRoastBatch();
  const [draft, setDraft] = useState<RoastBatchUpdateInput | null>(null);

  const editableFieldPath = fieldPath;
  const fieldLabel = useMemo(() => {
    switch (editableFieldPath) {
      case 'developmentRatio':
        return '发展比';
      case 'firstCrackTime':
        return '一爆时间';
      case 'greenBeanId':
        return '生豆';
      case 'inputWeightGrams':
        return '入豆量';
      case 'notes':
        return '备注';
      case 'outputWeightGrams':
        return '出豆量';
      case 'roastDate':
        return '烘焙日期';
      case 'roastLevel':
        return '烘焙程度';
      case 'roastPlanId':
        return '烘焙计划';
      case 'roastedBeanName':
        return '熟豆名称';
      case 'status':
        return '状态';
      case 'totalRoastTime':
        return '总烘焙时间';
      default:
        return '信息';
    }
  }, [editableFieldPath]);

  const availablePlans = useMemo(() => {
    if (!draft?.greenBeanId) {
      return [];
    }

    return plans.filter((plan) => {
      const planBeanId = String(plan.beanId);

      return planBeanId === GENERIC_BEAN_ID || planBeanId === draft.greenBeanId;
    });
  }, [draft?.greenBeanId, plans]);

  useEffect(() => {
    setDraft(createDraft(batch));
  }, [batch, editableFieldPath]);

  if (!open || batch == null || editableFieldPath == null) {
    return null;
  }

  if (draft == null) {
    return (
      <AppDrawer
        destroyOnHidden
        height={height}
        onClose={onClose}
        open={open}
        placement={placement}
        title={`修改${fieldLabel}`}
        width={width}
      >
        <section style={{ display: 'grid', placeItems: 'center', minHeight: '240px' }}>
          <Spin />
        </section>
      </AppDrawer>
    );
  }

  const updateDraft = <K extends RoastBatchEditableFieldPath>(key: K, value: RoastBatchUpdateInput[K]) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextDraft: RoastBatchUpdateInput = { ...current };
      nextDraft[key] = value;

      if (key === 'greenBeanId') {
        const nextBean = beans.find((bean) => String(bean.id) === String(value));
        nextDraft.greenBeanName = nextBean?.name ?? nextDraft.greenBeanName ?? '';
        nextDraft.roastPlanId = undefined;
        nextDraft.roastPlanName = undefined;
      }

      if (key === 'roastPlanId') {
        const nextPlan = plans.find((plan) => String(plan.id) === String(value));
        nextDraft.roastPlanName = nextPlan?.name ?? undefined;
      }

      if (key === 'roastedBeanName' && typeof value === 'string' && value.trim().length === 0) {
        nextDraft.roastedBeanName = undefined;
      }

      return nextDraft;
    });
  };

  const handleSubmit = () => {
    if (!draft.roastDate) {
      void message.warning('请选择烘焙日期。');
      return;
    }

    if (!draft.greenBeanId) {
      void message.warning('请选择生豆。');
      return;
    }

    if ((draft.inputWeightGrams ?? 0) <= 0) {
      void message.warning('请输入有效的入豆量。');
      return;
    }

    if ((draft.outputWeightGrams ?? 0) < 0) {
      void message.warning('请输入有效的出豆量。');
      return;
    }

    const updateInput: RoastBatchUpdateInput = {
      developmentRatio: draft.developmentRatio,
      firstCrackTime: draft.firstCrackTime,
      greenBeanId: draft.greenBeanId,
      greenBeanName: draft.greenBeanName,
      inputWeightGrams: draft.inputWeightGrams,
      notes: draft.notes,
      outputWeightGrams: draft.outputWeightGrams,
      roastDate: draft.roastDate,
      roastLevel: draft.roastLevel,
      roastPlanId: draft.roastPlanId,
      roastPlanName: draft.roastPlanName,
      roastedBeanName: draft.roastedBeanName,
      status: draft.status,
      totalRoastTime: draft.totalRoastTime,
    };

    onClose();
    submissionBackupService.save('update', { batchId: batch.id, input: updateInput }, 'roastBatch');

    const updateTask = updateBatchMutation.mutateAsync({ batchId: batch.id, input: updateInput }).catch(
      (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : '烘焙记录同步失败，本地已备份。';
        void message.error(errorMessage);
      },
    );

    void updateTask;
  };

  const renderField = () => {
    switch (editableFieldPath) {
      case 'roastDate':
        return (
          <DatePicker
            format="YYYY-MM-DD HH:mm"
            onChange={(date: Dayjs | null) => {
              updateDraft('roastDate', date ? date.second(0).millisecond(0).toISOString() : '');
            }}
            showTime={{ format: 'HH:mm' }}
            style={{ width: '100%' }}
            value={toPickerValue(draft.roastDate ?? '')}
          />
        );
      case 'greenBeanId':
        return (
          <Select
            onChange={(value) => {
              updateDraft('greenBeanId', value);
            }}
            options={beans.map((bean) => ({ label: bean.name, value: String(bean.id) }))}
            placeholder="选择生豆"
            showSearch
            value={draft.greenBeanId}
          />
        );
      case 'roastedBeanName':
        return (
          <Input
            onChange={(event) => {
              updateDraft('roastedBeanName', event.target.value);
            }}
            placeholder="未填写时默认继承生豆名称"
            value={draft.roastedBeanName ?? ''}
          />
        );
      case 'roastPlanId':
        return (
          <Select
            allowClear
            onChange={(value) => {
              const nextPlanId = value;
              updateDraft('roastPlanId', nextPlanId);
            }}
            options={availablePlans.map((plan) => ({
              label: `${plan.name}${String(plan.beanId) === GENERIC_BEAN_ID ? ' · 通用' : ''}`,
              value: String(plan.id),
            }))}
            placeholder={draft.greenBeanId ? '选择通用计划或当前生豆对应计划' : '请先选择生豆'}
            showSearch
            value={draft.roastPlanId}
          />
        );
      case 'inputWeightGrams':
        return (
          <InputNumber
            min={0}
            onChange={(value) => {
              updateDraft('inputWeightGrams', value ?? 0);
            }}
            precision={0}
            suffix="g"
            style={{ width: '100%' }}
            value={draft.inputWeightGrams ?? 0}
          />
        );
      case 'outputWeightGrams':
        return (
          <InputNumber
            min={0}
            onChange={(value) => {
              updateDraft('outputWeightGrams', value ?? 0);
            }}
            precision={0}
            suffix="g"
            style={{ width: '100%' }}
            value={draft.outputWeightGrams ?? 0}
          />
        );
      case 'roastLevel':
        return (
          <Select
            onChange={(value) => {
              updateDraft('roastLevel', value);
            }}
            options={ROAST_LEVELS.map((level) => ({ label: level, value: level }))}
            value={draft.roastLevel}
          />
        );
      case 'developmentRatio':
        return (
          <InputNumber
            max={100}
            min={0}
            onChange={(value) => {
              updateDraft('developmentRatio', value ?? undefined);
            }}
            precision={1}
            suffix="%"
            style={{ width: '100%' }}
            value={draft.developmentRatio ?? null}
          />
        );
      case 'firstCrackTime':
        return (
          <InputNumber
            min={0}
            onChange={(value) => {
              updateDraft('firstCrackTime', value ?? undefined);
            }}
            precision={0}
            suffix="s"
            style={{ width: '100%' }}
            value={draft.firstCrackTime ?? null}
          />
        );
      case 'totalRoastTime':
        return (
          <InputNumber
            min={0}
            onChange={(value) => {
              updateDraft('totalRoastTime', value ?? undefined);
            }}
            precision={0}
            suffix="s"
            style={{ width: '100%' }}
            value={draft.totalRoastTime ?? null}
          />
        );
      case 'notes':
        return (
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 6 }}
            onChange={(event) => {
              updateDraft('notes', event.target.value || undefined);
            }}
            placeholder="记录烘焙心得、调整建议等..."
            value={draft.notes ?? ''}
          />
        );
      case 'status':
        return (
          <Select
            onChange={(value) => {
              updateDraft('status', value);
            }}
            options={[
              { label: '草稿', value: 'draft' },
              { label: '已完成', value: 'completed' },
            ]}
            value={draft.status}
          />
        );
    }
  };

  return (
    <FieldEditorDrawer
      height={height}
      loadingLabel="保存中"
      onClose={onClose}
      onSubmit={handleSubmit}
      open={open}
      placement={placement}
      submitLabel={`保存${fieldLabel}`}
      title={`修改${fieldLabel}`}
      width={width}
    >
      <section style={{ display: 'grid', gap: '12px', padding: '16px 20px 0' }}>
        <label style={{ display: 'grid', gap: '8px' }}>
          <span style={{ color: 'var(--app-text-secondary)', fontSize: '12px', fontWeight: 700 }}>{fieldLabel}</span>
          {renderField()}
        </label>
      </section>
    </FieldEditorDrawer>
  );
}
