import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import Button from 'antd/es/button';
import DatePicker from 'antd/es/date-picker';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Select from 'antd/es/select';
import dayjs, { type Dayjs } from 'dayjs';

import type { Bean, RoastPlan } from '@/types/domain';
import type { RoastBatchSalesMode } from '@/modules/roast/types/roastBatch';
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

const ROAST_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm';

const toPickerValue = (value: string) => {
  if (!value) {
    return null;
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed : null;
};

export interface RoastBatchFormState {
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
  notes: string;
}

export interface RoastBatchFormSubmitValue {
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
  const roastLevelManualOverrideRef = useRef(false);
  const availablePlans = useMemo(
    () => getSelectableRoastPlans(plans, value.greenBeanId),
    [value.greenBeanId, plans],
  );
  const selectedBean = useMemo(
    () => beans.find((bean) => String(bean.id) === value.greenBeanId) ?? null,
    [beans, value.greenBeanId],
  );
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

    onSubmit({
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
    });
  };

  return (
    <div className={styles.form}>
      <section className={styles.section}>
        <h4>基本信息</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field} data-field-path="roastDate">
            <span className={styles.fieldLabel}>烘焙日期</span>
            <DatePicker
              aria-label="烘焙日期"
              format={ROAST_DATE_TIME_FORMAT}
              placeholder="选择烘焙日期与时间"
              showTime={{ format: 'HH:mm' }}
              value={toPickerValue(value.roastDate)}
              onChange={(date: Dayjs | null) => {
                onChange((current) => ({
                  ...current,
                  roastDate: date ? date.second(0).millisecond(0).toISOString() : '',
                }));
              }}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field} data-field-path="roastLevel">
            <span className={styles.fieldLabel}>烘焙程度</span>
            <Select
              aria-label="烘焙程度"
              value={normalizedRoastLevel}
              onChange={(nextValue) => {
                roastLevelManualOverrideRef.current = true;
                onChange((current) => ({ ...current, roastLevel: normalizeRoastLevel(nextValue) }));
              }}
              options={ROAST_LEVEL_OPTIONS.map((level) => ({ label: level, value: level }))}
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
            <span className={styles.fieldLabel}>生豆</span>
            <Select
              aria-label="生豆"
              disabled={beans.length === 0}
              onChange={(beanId: string) => {
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
              onChange={(nextValue: RoastBatchSalesMode) => {
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
              style={{ width: '100%' }}
            />
          </div>
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
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h4>烘焙数据</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field} data-field-path="inputWeightGrams">
            <span className={styles.fieldLabel}>入豆量 (g)</span>
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
            <span className={styles.fieldLabel}>出豆量 (g)</span>
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
