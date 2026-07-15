import { App } from 'antd';
import DatePicker from "antd/es/date-picker";
import Input from "antd/es/input";
import InputNumber from "antd/es/input-number";
import Select from "antd/es/select";
import Spin from "antd/es/spin";
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { ROAST_LEVEL_OPTIONS, normalizeRoastLevel } from '@/modules/roast/constants/roastLevel';
import { useRoastPlans } from '@/modules/roast/hooks';
import { useUpdateRoastBatch } from '@/modules/roast/hooks/useRoastBatches';
import type { RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import { getSelectableRoastPlans, isGenericRoastPlan } from '@/modules/roast/utils/roastPlanSelection';
import { FieldEditorDrawer } from '@/shared/components/FieldEditorDrawer';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
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
  | 'salesMode'
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
    roastLevel: normalizeRoastLevel(batch.roastLevel),
    roastPlanId: batch.roastPlanId,
    roastPlanName: batch.roastPlanName,
    roastedBeanName: batch.roastedBeanName,
    salesMode: batch.salesMode,
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
      case 'salesMode':
        return '去向';
      case 'status':
        return '状态';
      case 'totalRoastTime':
        return '总烘焙时间';
      default:
        return '信息';
    }
  }, [editableFieldPath]);

  const availablePlans = useMemo(
    () => getSelectableRoastPlans(plans, draft?.greenBeanId),
    [draft?.greenBeanId, plans],
  );

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
      salesMode: draft.salesMode,
      status: draft.status,
      totalRoastTime: draft.totalRoastTime,
    };

    onClose();
    submissionBackupService.save('update', { batchId: batch.id, input: updateInput }, 'roastBatch');

    const updateTask = updateBatchMutation.mutateAsync({ batchId: batch.id, input: updateInput }).catch(
      (error: unknown) => {
        void message.error(getUserFacingErrorMessage(error, '烘焙记录同步失败，本地备份已保留，请检查后重试。'));
      },
    );

    void updateTask;
  };

  const renderField = () => {
    switch (editableFieldPath) {
      case 'roastDate':
        return (
          <DatePicker
            aria-label={fieldLabel}
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
            aria-label={fieldLabel}
            onChange={(value) => {
              updateDraft('greenBeanId', value);
            }}
            options={beans.map((bean) => ({ label: bean.name, value: String(bean.id) }))}
            placeholder="选择生豆"
            showSearch={false}
            value={draft.greenBeanId}
          />
        );
      case 'roastedBeanName':
        return (
          <Input
            aria-label={fieldLabel}
            onChange={(event) => {
              updateDraft('roastedBeanName', event.target.value);
            }}
            placeholder="未填写时默认继承生豆名称"
            value={draft.roastedBeanName ?? ''}
          />
        );
      case 'salesMode':
        return (
          <Select
            aria-label={fieldLabel}
            onChange={(value) => {
              updateDraft('salesMode', value);
            }}
            options={[
              { label: '销售', value: 'sale' },
              { label: '自留', value: 'selfUse' },
            ]}
            showSearch={false}
            value={draft.salesMode ?? 'sale'}
          />
        );
      case 'roastPlanId':
        return (
          <Select
            aria-label={fieldLabel}
            allowClear
            onChange={(value) => {
              const nextPlanId = value;
              updateDraft('roastPlanId', nextPlanId);
            }}
            options={availablePlans.map((plan) => ({
              label: `${plan.name}${isGenericRoastPlan(plan) ? ' · 通用' : ''}`,
              value: String(plan.id),
            }))}
            disabled={availablePlans.length === 0}
            placeholder={draft.greenBeanId ? '选择通用计划或当前生豆对应计划' : '可先选择通用计划'}
            showSearch={false}
            value={draft.roastPlanId}
          />
        );
      case 'inputWeightGrams':
        return (
          <InputNumber
            aria-label={fieldLabel}
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
            aria-label={fieldLabel}
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
            aria-label={fieldLabel}
            onChange={(value) => {
              updateDraft('roastLevel', value);
            }}
            options={ROAST_LEVEL_OPTIONS.map((level) => ({ label: level, value: level }))}
            showSearch={false}
            value={draft.roastLevel}
          />
        );
      case 'developmentRatio':
        return (
          <InputNumber
            aria-label={fieldLabel}
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
            aria-label={fieldLabel}
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
            aria-label={fieldLabel}
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
            aria-label={fieldLabel}
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
            aria-label={fieldLabel}
            onChange={(value) => {
              updateDraft('status', value);
            }}
            options={[
              { label: '草稿', value: 'draft' },
              { label: '已完成', value: 'completed' },
            ]}
            showSearch={false}
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
      <section style={{ display: 'grid', gap: '10px', padding: 0 }}>
        <label style={{ display: 'grid', gap: '6px' }}>
          <span style={{ color: 'var(--app-text-secondary)', fontSize: '12px', fontWeight: 700 }}>{fieldLabel}</span>
          {renderField()}
        </label>
      </section>
    </FieldEditorDrawer>
  );
}
