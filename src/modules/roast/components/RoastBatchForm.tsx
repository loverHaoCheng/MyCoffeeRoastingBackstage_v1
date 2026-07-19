import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import Button from 'antd/es/button';
import Checkbox from 'antd/es/checkbox';
import App from 'antd/es/app';
import { Select } from '@/components/ui/select';
import { AdaptiveDateTimeField } from '@/shared/components/AdaptiveDateTimeField';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';

import type { Bean, RoastPlan } from '@/types/domain';
import type { RoastBatchEvaluation, RoastBatchSalesMode } from '@/modules/roast/types/roastBatch';
import { calculateRoastSaleCapacity, resolveBeanCostTemplate } from '@/modules/finance/services/financeProfitCalculation.service';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import {
  ROAST_LEVEL_OPTIONS,
  calculateDehydrationRate,
  normalizeRoastLevel,
  resolveRoastLevelFromDehydrationRate,
} from '@/modules/roast/constants/roastLevel';
import { getSelectableRoastPlans, isGenericRoastPlan } from '@/modules/roast/utils/roastPlanSelection';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { scrollToField } from '@/shared/forms/scrollToField';

import styles from './RoastBatchForm.module.css';

export interface RoastBatchFormState {
  evaluation: RoastBatchEvaluation;
  roastDate: string;
  greenBeanId: string;
  greenBeanName: string;
  roastedBeanName: string;
  salesMode: RoastBatchSalesMode;
  roastPlanId: string;
  roastPlanName: string;
  inputWeightGrams: number;
  outputWeightGrams: number;
  roastLevel: string;
  developmentRatio: number | undefined;
  firstCrackTime: number | undefined;
  totalRoastTime: number | undefined;
  finalSaleUnitPrice: number | undefined;
  soldUnitCount: number;
  notes: string;
}

export interface RoastBatchFormSubmitValue {
  evaluation: RoastBatchEvaluation;
  developmentRatio: number | undefined;
  firstCrackTime: number | undefined;
  greenBeanId: string;
  greenBeanName: string;
  inputWeightGrams: number;
  notes: string | undefined;
  outputWeightGrams: number;
  roastDate: string;
  roastLevel: string;
  roastPlanId: string | undefined;
  roastPlanName: string | undefined;
  roastedBeanName: string;
  salesMode: RoastBatchSalesMode;
  totalRoastTime: number | undefined;
  finalSaleUnitPrice: number | null | undefined;
  soldUnitCount: number;
}

interface RoastBatchFormProps {
  beans: Bean[];
  curveSection: ReactNode;
  isSubmitting?: boolean;
  onCancel?: () => void;
  onChange: Dispatch<SetStateAction<RoastBatchFormState>>;
  onSubmit: (value: RoastBatchFormSubmitValue) => void;
  plans: RoastPlan[];
  resetKey?: string;
  submitDisabled?: boolean;
  submitIcon: ReactNode;
  submitLabel: string;
  value: RoastBatchFormState;
}

const SCORE_OPTIONS = [
  { label: '1 分', value: 1 },
  { label: '2 分', value: 2 },
  { label: '3 分', value: 3 },
  { label: '4 分', value: 4 },
  { label: '5 分', value: 5 },
];

const renderRequiredLabel = (label: string) => {
  return (
    <span className={styles.fieldLabel}>
      {label}
      <em aria-hidden="true" className={styles.requiredMark}>
        *
      </em>
    </span>
  );
};

export function RoastBatchForm({
  beans,
  curveSection,
  isSubmitting = false,
  onCancel,
  onChange,
  onSubmit,
  plans,
  resetKey,
  submitDisabled = false,
  submitIcon,
  submitLabel,
  value,
}: RoastBatchFormProps) {
  const { message } = App.useApp();
  const { costTemplateSettings } = useCostTemplateSettings();
  const roastLevelManualOverrideRef = useRef(false);
  const availablePlans = useMemo(
    () => getSelectableRoastPlans(plans, value.greenBeanId),
    [value.greenBeanId, plans],
  );
  const selectedBean = useMemo(
    () => beans.find((bean) => String(bean.id) === value.greenBeanId) ?? null,
    [beans, value.greenBeanId],
  );
  const maximumSoldUnitCount = useMemo(() => {
    if (!selectedBean) {
      return null;
    }

    const template = resolveBeanCostTemplate(selectedBean, new Map(costTemplateSettings.templates.map((item) => [item.id, item])));
    return template ? calculateRoastSaleCapacity(value.inputWeightGrams, template).maximumSoldUnitCount : null;
  }, [costTemplateSettings.templates, selectedBean, value.inputWeightGrams]);
  const dehydrationRate = useMemo(
    () => calculateDehydrationRate(value.inputWeightGrams, value.outputWeightGrams),
    [value.inputWeightGrams, value.outputWeightGrams],
  );
  const suggestedRoastLevel = useMemo(
    () => resolveRoastLevelFromDehydrationRate(dehydrationRate),
    [dehydrationRate],
  );
  const normalizedRoastLevel = normalizeRoastLevel(value.roastLevel);
  const lossRate = value.inputWeightGrams > 0
    ? (((value.inputWeightGrams - value.outputWeightGrams) / value.inputWeightGrams) * 100).toFixed(1)
    : '-';

  useEffect(() => {
    roastLevelManualOverrideRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    if (roastLevelManualOverrideRef.current) {
      return;
    }

    onChange((current) =>
      current.roastLevel === suggestedRoastLevel ? current : { ...current, roastLevel: suggestedRoastLevel },
    );
  }, [onChange, suggestedRoastLevel]);

  const handleSubmit = () => {
    if (!value.roastDate) {
      scrollToField('roastDate');
      return;
    }

    if (!value.greenBeanId) {
      scrollToField('greenBeanId');
      return;
    }

    if (value.inputWeightGrams <= 0) {
      scrollToField('inputWeightGrams');
      return;
    }

    if (value.outputWeightGrams < 0) {
      scrollToField('outputWeightGrams');
      return;
    }

    if (
      value.salesMode === 'sale' &&
      maximumSoldUnitCount != null &&
      value.soldUnitCount > maximumSoldUnitCount
    ) {
      void message.warning(`已售份数不能超过本锅最多可售的 ${String(maximumSoldUnitCount)} 份。`);
      scrollToField('soldUnitCount');
      return;
    }

    onSubmit({
      evaluation: {
        allowTraining: value.evaluation.allowTraining,
        defectNotes: value.evaluation.defectNotes?.trim() ? value.evaluation.defectNotes.trim() : undefined,
        flavorNotes: value.evaluation.flavorNotes?.trim() ? value.evaluation.flavorNotes.trim() : undefined,
        nextAdjustmentNotes: value.evaluation.nextAdjustmentNotes?.trim()
          ? value.evaluation.nextAdjustmentNotes.trim()
          : undefined,
        overallScore: value.evaluation.overallScore,
        targetMatchScore: value.evaluation.targetMatchScore,
      },
      developmentRatio: value.developmentRatio,
      firstCrackTime: value.firstCrackTime,
      greenBeanId: value.greenBeanId,
      greenBeanName: value.greenBeanName,
      inputWeightGrams: value.inputWeightGrams,
      notes: value.notes === '' ? undefined : value.notes,
      outputWeightGrams: value.outputWeightGrams,
      roastDate: value.roastDate,
      roastLevel: normalizedRoastLevel,
      roastPlanId: value.roastPlanId === '' ? undefined : value.roastPlanId,
      roastPlanName: value.roastPlanName === '' ? undefined : value.roastPlanName,
      roastedBeanName: value.roastedBeanName.trim() || value.greenBeanName,
      salesMode: value.salesMode,
      totalRoastTime: value.totalRoastTime,
      finalSaleUnitPrice: value.salesMode === 'sale' ? value.finalSaleUnitPrice ?? 0 : null,
      soldUnitCount: value.salesMode === 'sale' ? value.soldUnitCount : 0,
    });
  };

  return (
    <div className={styles.form}>
      <section className={styles.section}>
        <h4>基本信息</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field} data-field-path="roastDate">
            {renderRequiredLabel('烘焙日期')}
            <AdaptiveDateTimeField
              ariaLabel="烘焙日期"
              mode="datetime"
              placeholder="选择烘焙日期与时间"
              value={value.roastDate}
              onChange={(nextValue) => {
                onChange((current) => ({
                  ...current,
                  roastDate: nextValue,
                }));
              }}
            />
          </div>
          <div className={styles.field} data-field-path="roastLevel">
            {renderRequiredLabel('烘焙程度')}
            <Select
              aria-label="烘焙程度"
              value={normalizedRoastLevel}
              onChange={(nextValue) => {
                roastLevelManualOverrideRef.current = true;
                onChange((current) => ({ ...current, roastLevel: normalizeRoastLevel(nextValue) }));
              }}
              options={ROAST_LEVEL_OPTIONS.map((level) => ({ label: level, value: level }))}
              showSearch={false}
              style={{ width: '100%' }}
            />
            <div className={styles.inlineHint}>
              自动匹配：{suggestedRoastLevel}，当前脱水率 {dehydrationRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h4>生豆信息</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field} data-field-path="greenBeanId">
            {renderRequiredLabel('生豆')}
            <Select
              aria-label="生豆"
              disabled={beans.length === 0}
              onChange={(beanId) => {
                if (!beanId) {
                  return;
                }

                const bean = beans.find((item) => String(item.id) === beanId);

                onChange((current) => ({
                  ...current,
                  finalSaleUnitPrice:
                    current.salesMode === 'sale' ? bean?.defaultSaleUnitPrice ?? undefined : current.finalSaleUnitPrice,
                  greenBeanId: beanId,
                  greenBeanName: bean?.name ?? '',
                  roastPlanId: '',
                  roastPlanName: '',
                }));
              }}
              options={beans.map((bean) => ({ label: bean.name, value: String(bean.id) }))}
              placeholder="选择生豆"
              showSearch={false}
              value={value.greenBeanId === '' ? undefined : value.greenBeanId}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field} data-field-path="roastedBeanName">
            <span className={styles.fieldLabel}>熟豆名称</span>
            <Input
              aria-label="熟豆名称"
              value={value.roastedBeanName}
              onChange={(event) => {
                onChange((current) => ({ ...current, roastedBeanName: event.target.value }));
              }}
              placeholder={value.greenBeanName === '' ? '未填写时默认继承生豆名称' : value.greenBeanName}
            />
          </div>
          <div className={styles.field} data-field-path="salesMode">
            <span className={styles.fieldLabel}>去向</span>
            <Select
              aria-label="去向"
              value={value.salesMode}
              onChange={(nextValue) => {
                if (!nextValue) {
                  return;
                }

                onChange((current) => ({
                  ...current,
                  finalSaleUnitPrice:
                    nextValue === 'sale' ? current.finalSaleUnitPrice ?? selectedBean?.defaultSaleUnitPrice ?? undefined : undefined,
                  salesMode: nextValue,
                }));
              }}
              options={[
                { label: '销售', value: 'sale' },
                { label: '自留', value: 'selfUse' },
              ]}
              showSearch={false}
              style={{ width: '100%' }}
            />
          </div>
          {value.salesMode === 'sale' ? (
            <div className={styles.field} data-field-path="soldUnitCount">
              <span className={styles.fieldLabel}>已售份数</span>
              <InputNumber
                aria-label="已售份数"
                min={0}
                max={maximumSoldUnitCount ?? undefined}
                precision={0}
                value={value.soldUnitCount}
                onChange={(nextValue) => {
                  onChange((current) => ({
                    ...current,
                    soldUnitCount: nextValue ?? 0,
                  }));
                }}
                style={{ width: '100%' }}
              />
              <div className={styles.inlineHint}>
                {maximumSoldUnitCount == null
                  ? '选择已关联成本模板的生豆后，可计算最多可售份数。'
                  : `本锅最多可售 ${String(maximumSoldUnitCount)} 份；已实现收入与生豆成本按已售份数计算。`}
              </div>
            </div>
          ) : null}
          {value.salesMode === 'sale' ? (
            <div className={styles.field} data-field-path="finalSaleUnitPrice">
              <span className={styles.fieldLabel}>本次最终定价</span>
              <InputNumber
                aria-label="本次最终定价"
                min={0}
                precision={2}
                prefix="¥"
                value={value.finalSaleUnitPrice}
                onChange={(nextValue) => {
                  onChange((current) => ({
                    ...current,
                    finalSaleUnitPrice: nextValue ?? undefined,
                  }));
                }}
                style={{ width: '100%' }}
              />
              <div className={styles.inlineHint}>
                默认取生豆最终定价，只影响本次烘焙记录收入。
              </div>
            </div>
          ) : null}
          <div className={styles.field} data-field-path="roastPlanId">
            <span className={styles.fieldLabel}>烘焙计划</span>
            <Select
              aria-label="烘焙计划"
              allowClear
              value={value.roastPlanId === '' ? undefined : value.roastPlanId}
              onChange={(planId: string | undefined) => {
                const plan = availablePlans.find((item) => String(item.id) === planId);

                onChange((current) => ({
                  ...current,
                  roastPlanId: planId ?? '',
                  roastPlanName: plan?.name ?? '',
                }));
              }}
              placeholder={value.greenBeanId ? '选择通用计划或当前生豆对应计划' : '可先选择通用计划'}
              options={availablePlans.map((plan) => ({
                label: `${plan.name}${isGenericRoastPlan(plan) ? ' · 通用' : ''}`,
                value: String(plan.id),
              }))}
              disabled={availablePlans.length === 0}
              showSearch={false}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h4>烘焙数据</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field} data-field-path="inputWeightGrams">
            {renderRequiredLabel('入豆量 (g)')}
            <InputNumber
              aria-label="入豆量"
              value={value.inputWeightGrams}
              onChange={(nextValue) => {
                onChange((current) => ({ ...current, inputWeightGrams: nextValue ?? 0 }));
              }}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field} data-field-path="outputWeightGrams">
            {renderRequiredLabel('出豆量 (g)')}
            <InputNumber
              aria-label="出豆量"
              value={value.outputWeightGrams}
              onChange={(nextValue) => {
                onChange((current) => ({ ...current, outputWeightGrams: nextValue ?? 0 }));
              }}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field} data-field-path="developmentRatio">
            <span className={styles.fieldLabel}>失水率</span>
            <span className={styles.fieldValue}>{lossRate}%</span>
          </div>
          <div className={styles.field} data-field-path="firstCrackTime">
            <span className={styles.fieldLabel}>发展比 (%)</span>
            <InputNumber
              aria-label="发展比"
              value={value.developmentRatio}
              onChange={(nextValue) => {
                onChange((current) => ({ ...current, developmentRatio: nextValue ?? undefined }));
              }}
              min={0}
              max={100}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field} data-field-path="totalRoastTime">
            <span className={styles.fieldLabel}>一爆时间 (s)</span>
            <InputNumber
              aria-label="一爆时间"
              value={value.firstCrackTime}
              onChange={(nextValue) => {
                onChange((current) => ({ ...current, firstCrackTime: nextValue ?? undefined }));
              }}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>总烘焙时间 (s)</span>
            <InputNumber
              aria-label="总烘焙时间"
              value={value.totalRoastTime}
              onChange={(nextValue) => {
                onChange((current) => ({ ...current, totalRoastTime: nextValue ?? undefined }));
              }}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h4>评价表单</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>综合评分</span>
            <Select
              aria-label="综合评分"
              allowClear
              options={SCORE_OPTIONS}
              placeholder="选择 1-5 分"
              showSearch={false}
              value={value.evaluation.overallScore}
              onChange={(nextValue) => {
                onChange((current) => ({
                  ...current,
                  evaluation: { ...current.evaluation, overallScore: nextValue },
                }));
              }}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>目标达成度</span>
            <Select
              aria-label="目标达成度"
              allowClear
              options={SCORE_OPTIONS}
              placeholder="选择 1-5 分"
              showSearch={false}
              value={value.evaluation.targetMatchScore}
              onChange={(nextValue) => {
                onChange((current) => ({
                  ...current,
                  evaluation: { ...current.evaluation, targetMatchScore: nextValue },
                }));
              }}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>风味描述</span>
            <Input.TextArea
              aria-label="风味描述"
              rows={3}
              value={value.evaluation.flavorNotes ?? ''}
              onChange={(event) => {
                onChange((current) => ({
                  ...current,
                  evaluation: { ...current.evaluation, flavorNotes: event.target.value },
                }));
              }}
              placeholder="记录杯测印象、甜感、酸质、醇厚度等"
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>缺陷记录</span>
            <Input.TextArea
              aria-label="缺陷记录"
              rows={3}
              value={value.evaluation.defectNotes ?? ''}
              onChange={(event) => {
                onChange((current) => ({
                  ...current,
                  evaluation: { ...current.evaluation, defectNotes: event.target.value },
                }));
              }}
              placeholder="例如 烟感偏重、发展不足、风味发木"
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>下次调整建议</span>
            <Input.TextArea
              aria-label="下次调整建议"
              rows={3}
              value={value.evaluation.nextAdjustmentNotes ?? ''}
              onChange={(event) => {
                onChange((current) => ({
                  ...current,
                  evaluation: { ...current.evaluation, nextAdjustmentNotes: event.target.value },
                }));
              }}
              placeholder="例如 一爆前减火提前 20 秒，后段风门再开 5%"
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>训练授权</span>
            <label className={styles.checkboxField}>
              <Checkbox
                checked={value.evaluation.allowTraining}
                onChange={(event) => {
                  onChange((current) => ({
                    ...current,
                    evaluation: { ...current.evaluation, allowTraining: event.target.checked },
                  }));
                }}
              >
                允许将本次匿名烘焙数据用于同型号模型训练
              </Checkbox>
            </label>
            <div className={styles.inlineHint}>默认关闭。开启后，本次上传并进入训练流程的数据不支持逐条撤回。</div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h4>备注</h4>
        <Input.TextArea
          aria-label="备注"
          value={value.notes}
          onChange={(event) => {
            onChange((current) => ({ ...current, notes: event.target.value }));
          }}
          placeholder="记录烘焙心得、调整建议等..."
          rows={3}
        />
      </section>

      <section className={styles.section}>{curveSection}</section>

      <DrawerActionBar compact>
        {onCancel ? <Button onClick={onCancel}>取消</Button> : null}
        <Button
          aria-label={submitLabel}
          block
          className={styles.submitButton}
          disabled={isSubmitting || submitDisabled}
          icon={submitIcon}
          loading={isSubmitting}
          onClick={handleSubmit}
          size="large"
          type="primary"
        >
          {submitLabel}
        </Button>
      </DrawerActionBar>
    </div>
  );
}
