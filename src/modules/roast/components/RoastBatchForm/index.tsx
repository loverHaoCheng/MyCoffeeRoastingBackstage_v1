import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';

import App from 'antd/es/app';
import Button from 'antd/es/button';
import Input from '@/shared/components/ui/input';

import type { Bean, RoastPlan } from '@/types/domain';
import type { ReactNode } from 'react';
import type { RoastBatchFormState, RoastBatchFormSubmitValue } from './types';
import { buildRoastBatchSaleSnapshot } from '@/modules/finance/services/financeProfitCalculation.service';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { scrollToField } from '@/shared/forms/scrollToField';
import { RoastEvaluationEditor } from '../RoastEvaluationEditor';
import { useRoastBatchFormLogic } from './useRoastBatchFormLogic';
import { BasicInfoFields } from './BasicInfoFields';
import { GreenBeanFields } from './GreenBeanFields';
import { RoastDataFields } from './RoastDataFields';

import styles from './RoastBatchForm.module.css';

interface RoastBatchFormProps {
  analysisSection?: ReactNode;
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
  actionBarAtTop?: boolean;
  trainingSection?: ReactNode;
  value: RoastBatchFormState;
}

export function RoastBatchForm({
  analysisSection,
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
  actionBarAtTop = false,
  trainingSection,
  value,
}: RoastBatchFormProps) {
  const { message } = App.useApp();
  const {
    availablePlans,
    selectedBean,
    selectedCostTemplate,
    maximumSoldUnitCount,
    dehydrationRate,
    suggestedRoastLevel,
    normalizedRoastLevel,
    lossRate,
    roastLevelManualOverrideRef,
  } = useRoastBatchFormLogic({ beans, plans, value });

  useEffect(() => {
    roastLevelManualOverrideRef.current = false;
    // roastLevelManualOverrideRef is stable and doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (roastLevelManualOverrideRef.current || value.roastLevelSource === 'manual') {
      return;
    }

    onChange((current) =>
      current.roastLevel === suggestedRoastLevel ? current : { ...current, roastLevel: suggestedRoastLevel },
    );
    // roastLevelManualOverrideRef is stable and doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, suggestedRoastLevel, value.roastLevelSource]);

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

    const saleSnapshot = value.salesMode === 'sale' && selectedBean && selectedCostTemplate
      ? buildRoastBatchSaleSnapshot(selectedBean, selectedCostTemplate, value.finalSaleUnitPrice)
      : null;

    onSubmit({
      beanAgtronColor: value.beanAgtronColor,
      beanCostPerSaleUnitSnapshot: saleSnapshot?.beanCostPerSaleUnit,
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
      groundAgtronColor: value.groundAgtronColor,
      greenBeanId: value.greenBeanId,
      greenBeanName: value.greenBeanName,
      inputWeightGrams: value.inputWeightGrams,
      notes: value.notes === '' ? undefined : value.notes,
      outputWeightGrams: value.outputWeightGrams,
      roastDate: value.roastDate,
      roastLevel: normalizedRoastLevel,
      roastLevelSource: value.roastLevelSource,
      roastPlanId: value.roastPlanId === '' ? undefined : value.roastPlanId,
      roastPlanName: value.roastPlanName === '' ? undefined : value.roastPlanName,
      roastedBeanName: value.roastedBeanName.trim() || value.greenBeanName,
      salesMode: value.salesMode,
      totalRoastTime: value.totalRoastTime,
      finalSaleUnitPrice: value.salesMode === 'sale' ? value.finalSaleUnitPrice ?? 0 : null,
      nonBeanCostPerSaleUnitSnapshot: saleSnapshot?.nonBeanCostPerSaleUnit,
      saleUnitPriceSnapshot: saleSnapshot?.saleUnitPrice,
      soldUnitCount: value.salesMode === 'sale' ? value.soldUnitCount : 0,
    });
  };

  return (
    <form
      className={styles.form}
      data-action-bar-at-top={actionBarAtTop ? 'true' : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <BasicInfoFields
        value={value}
        onChange={onChange}
        dehydrationRate={dehydrationRate}
        suggestedRoastLevel={suggestedRoastLevel}
        normalizedRoastLevel={normalizedRoastLevel}
        roastLevelManualOverrideRef={roastLevelManualOverrideRef}
      />

      <GreenBeanFields
        value={value}
        onChange={onChange}
        beans={beans}
        selectedBean={selectedBean}
        availablePlans={availablePlans}
        maximumSoldUnitCount={maximumSoldUnitCount}
      />

      <RoastDataFields value={value} onChange={onChange} lossRate={lossRate} />

      <section className={styles.section} data-section="curve">{curveSection}</section>
      {analysisSection}

      <section className={styles.section} data-section="evaluation">
        <h4>评价表单</h4>
        <RoastEvaluationEditor
          evaluation={value.evaluation}
          onChange={(evaluation) => {
            onChange((current) => ({ ...current, evaluation }));
          }}
        />
      </section>

      {trainingSection}

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

      {!actionBarAtTop ? (
        <DrawerActionBar compact>
          {onCancel ? <Button onClick={onCancel}>取消</Button> : null}
          <Button
            aria-label={submitLabel}
            block
            className={styles.submitButton}
            disabled={isSubmitting || submitDisabled}
            icon={submitIcon}
            loading={isSubmitting}
            size="large"
            htmlType="submit"
            type="primary"
          >
            {submitLabel}
          </Button>
        </DrawerActionBar>
      ) : null}
    </form>
  );
}
