import type { ReactNode } from 'react';
import Segmented from 'antd/es/segmented';
import { Select } from '@/shared/components/ui/select';
import { AdaptiveDateTimeField } from '@/shared/components/AdaptiveDateTimeField';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';

import {
  ROAST_LEVEL_OPTIONS,
  ROAST_LEVEL_SOURCE_OPTIONS,
  resolveRoastLevelFromAgtron,
} from '@/modules/roast/constants/roastLevel';
import type { RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import { getSelectableRoastPlans, isGenericRoastPlan } from '@/modules/roast/utils/roastPlanSelection';
import type { Bean, RoastPlan } from '@/types/domain';
import type { RoastBatchEditableFieldPath } from './fieldLabels';

interface RenderFieldProps {
  draft: RoastBatchUpdateInput;
  effectiveFieldPath: RoastBatchEditableFieldPath;
  fieldLabel: string;
  beans: Bean[];
  plans: RoastPlan[];
  maximumSoldUnitCount: null | number;
  updateDraft: <K extends RoastBatchEditableFieldPath>(key: K, value: RoastBatchUpdateInput[K]) => void;
}

export const renderBatchField = ({
  draft,
  effectiveFieldPath,
  fieldLabel,
  beans,
  plans,
  maximumSoldUnitCount,
  updateDraft,
}: RenderFieldProps): ReactNode => {
  const availablePlans = getSelectableRoastPlans(plans, draft.greenBeanId);

  switch (effectiveFieldPath) {
    case 'roastDate':
      return (
        <AdaptiveDateTimeField
          ariaLabel={fieldLabel}
          mode="datetime"
          placeholder="选择烘焙日期与时间"
          value={draft.roastDate ?? ''}
          onChange={(nextValue) => {
            updateDraft('roastDate', nextValue);
          }}
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
    case 'soldUnitCount':
      return (
        <InputNumber
          aria-label={fieldLabel}
          min={0}
          max={maximumSoldUnitCount ?? undefined}
          onChange={(value) => {
            updateDraft('soldUnitCount', value ?? 0);
          }}
          precision={0}
          style={{ width: '100%' }}
          value={draft.soldUnitCount ?? 0}
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
    case 'beanAgtronColor':
      return (
        <InputNumber
          aria-label={fieldLabel}
          max={100}
          min={0}
          onChange={(value) => {
            updateDraft('beanAgtronColor', value ?? undefined);
          }}
          precision={1}
          style={{ width: '100%' }}
          value={draft.beanAgtronColor ?? null}
        />
      );
    case 'groundAgtronColor':
      return (
        <InputNumber
          aria-label={fieldLabel}
          max={100}
          min={0}
          onChange={(value) => {
            updateDraft('groundAgtronColor', value ?? undefined);
          }}
          precision={1}
          style={{ width: '100%' }}
          value={draft.groundAgtronColor ?? null}
        />
      );
    case 'roastLevel':
      return (
        <Select
          aria-label={fieldLabel}
          onChange={(value) => {
            updateDraft('roastLevel', value);
            updateDraft('roastLevelSource', 'manual');
          }}
          options={ROAST_LEVEL_OPTIONS.map((level) => ({ label: level, value: level }))}
          showSearch={false}
          value={draft.roastLevel}
        />
      );
    case 'roastLevelSource':
      return (
        <Segmented
          block
          options={ROAST_LEVEL_SOURCE_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
          value={draft.roastLevelSource ?? 'dehydrationRate'}
          onChange={(value) => {
            const source = value as NonNullable<RoastBatchUpdateInput['roastLevelSource']>;
            const agtronValue = source === 'beanAgtron' ? draft.beanAgtronColor : draft.groundAgtronColor;
            const nextLevel = source === 'manual' ? draft.roastLevel : resolveRoastLevelFromAgtron(agtronValue ?? Number.NaN);
            updateDraft('roastLevelSource', source);
            if (nextLevel != null) {
              updateDraft('roastLevel', nextLevel);
            }
          }}
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
