import { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from '@/components/ui/select';
import { AdaptiveDateTimeField } from '@/shared/components/AdaptiveDateTimeField';
import InputNumber from '@/shared/components/ui/input-number';
import { Controller, type FieldPath, useForm } from 'react-hook-form';

import { greenBeanCreateFormSchema } from '@/modules/bean/schemas';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { scrollToField } from '@/shared/forms/scrollToField';
import { beanFormFieldPathMap, calculateTemplateDrivenSaleDefaults } from '@/modules/bean/utils/beanForm.utils';

import type { GreenBeanFormInput } from '../types/localGreenBean';
import styles from './BeanForm.module.css';
import { BeanFormActions } from './BeanFormActions';
import { BeanIdentitySection } from './BeanIdentitySection';
import { BeanNotesSection } from './BeanNotesSection';
import { BeanPostRoastSection } from './BeanPostRoastSection';
import { BeanQualitySection } from './BeanQualitySection';

interface BeanFormProps {
  autoApplyDefaultCostTemplate?: boolean;
  enableCostTemplateSelection?: boolean;
  focusFieldPath?: FieldPath<GreenBeanFormInput>;
  initialValues: GreenBeanFormInput;
  onCancel?: () => void;
  onSubmit: (input: GreenBeanFormInput) => Promise<void> | void;
  resetOnSubmit?: boolean;
  submitLabel: string;
}

const getErrorMessage = (message: string | undefined, fallback: string): string => message ?? fallback;
const toNullableNumber = (value: null | number): null | number => value ?? null;
const joinClassNames = (...classNames: (string | undefined)[]): string => classNames.filter(Boolean).join(' ');

const renderLabel = (label: string, required = false) => {
  return (
    <span className={styles.labelText}>
      {label}
      {required ? (
        <em aria-hidden="true" className={styles.requiredMark}>
          *
        </em>
      ) : null}
    </span>
  );
};

export function BeanForm({
  autoApplyDefaultCostTemplate = false,
  enableCostTemplateSelection = false,
  focusFieldPath,
  initialValues,
  onCancel,
  onSubmit,
  resetOnSubmit = false,
  submitLabel,
}: BeanFormProps) {
  const { costTemplateSettings } = useCostTemplateSettings();
  const [selectedTemplateId, setSelectedTemplateId] = useState<null | string>(null);
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setError,
    setFocus,
    setValue,
    watch,
  } = useForm<GreenBeanFormInput>({
    defaultValues: initialValues,
  });
  const templateSyncShouldDirtyRef = useRef(false);
  const lastPurchasedWeightRef = useRef(initialValues.purchasedWeightGrams);
  const lastAutoSaleDefaultsRef = useRef<{ price: null | number; weight: null | number }>({
    price: null,
    weight: null,
  });
  const manualSaleDefaultsRef = useRef({
    price: false,
    weight: false,
  });
  const currentRoastInputGrams = watch('defaultRoastInputGrams');
  const currentPurchasedTotalPrice = watch('purchasedTotalPrice');
  const currentPurchasedWeightGrams = watch('purchasedWeightGrams');
  const currentRemainingWeightGrams = watch('remainingWeightGrams');
  const currentDefaultSaleUnitPrice = watch('defaultSaleUnitPrice');
  const currentDefaultSaleUnitWeightGrams = watch('defaultSaleUnitWeightGrams');
  const selectedTemplate = useMemo(() => {
    if (!enableCostTemplateSelection) {
      return null;
    }

    return (
      costTemplateSettings.templates.find((template) => template.id === selectedTemplateId) ??
      costTemplateSettings.templates.find((template) => template.id === costTemplateSettings.defaultTemplateId) ??
      null
    );
  }, [
    costTemplateSettings.defaultTemplateId,
    costTemplateSettings.templates,
    enableCostTemplateSelection,
    selectedTemplateId,
  ]);

  useEffect(() => {
    reset(initialValues);
    lastPurchasedWeightRef.current = initialValues.purchasedWeightGrams;
    lastAutoSaleDefaultsRef.current = {
      price: null,
      weight: null,
    };
    manualSaleDefaultsRef.current = {
      price: false,
      weight: false,
    };
    templateSyncShouldDirtyRef.current = false;
    setSelectedTemplateId(
      enableCostTemplateSelection
        ? initialValues.costTemplateId ??
            (autoApplyDefaultCostTemplate ? costTemplateSettings.defaultTemplateId ?? null : null)
        : null,
    );
  }, [
    autoApplyDefaultCostTemplate,
    costTemplateSettings.defaultTemplateId,
    enableCostTemplateSelection,
    initialValues,
    reset,
  ]);

  useEffect(() => {
    if (!focusFieldPath) {
      return;
    }

    window.requestAnimationFrame(() => {
      scrollToField(focusFieldPath);
      setFocus(focusFieldPath);
    });
  }, [focusFieldPath, setFocus]);

  useEffect(() => {
    if (!enableCostTemplateSelection) {
      return;
    }

    if (selectedTemplateId == null && autoApplyDefaultCostTemplate && costTemplateSettings.defaultTemplateId) {
      templateSyncShouldDirtyRef.current = false;
      setSelectedTemplateId(costTemplateSettings.defaultTemplateId);
      setValue('costTemplateId', costTemplateSettings.defaultTemplateId, { shouldDirty: false });
      return;
    }

    if (selectedTemplateId != null) {
      setValue('costTemplateId', selectedTemplateId, { shouldDirty: false });
    }
  }, [
    autoApplyDefaultCostTemplate,
    costTemplateSettings.defaultTemplateId,
    enableCostTemplateSelection,
    selectedTemplateId,
    setValue,
  ]);

  useEffect(() => {
    if (!enableCostTemplateSelection || !selectedTemplate) {
      return;
    }

    const shouldDirty = templateSyncShouldDirtyRef.current;

    setValue('costTemplateId', selectedTemplate.id, { shouldDirty });
    setValue('defaultRoastInputGrams', selectedTemplate.roastInputWeightGrams, { shouldDirty });
    templateSyncShouldDirtyRef.current = true;
  }, [enableCostTemplateSelection, selectedTemplate, setValue]);

  useEffect(() => {
    const previousPurchasedWeight = lastPurchasedWeightRef.current;

    if (
      currentPurchasedWeightGrams !== previousPurchasedWeight &&
      currentRemainingWeightGrams === previousPurchasedWeight
    ) {
      setValue('remainingWeightGrams', currentPurchasedWeightGrams, { shouldDirty: true });
    }

    lastPurchasedWeightRef.current = currentPurchasedWeightGrams;
  }, [currentPurchasedWeightGrams, currentRemainingWeightGrams, setValue]);

  const templatePreview = useMemo(() => {
    if (!selectedTemplate) {
      return null;
    }

    return calculateTemplateDrivenSaleDefaults(selectedTemplate, {
      defaultRoastInputGrams: currentRoastInputGrams > 0 ? currentRoastInputGrams : selectedTemplate.roastInputWeightGrams,
      purchasedTotalPrice: currentPurchasedTotalPrice,
      purchasedWeightGrams: currentPurchasedWeightGrams,
    });
  }, [currentPurchasedTotalPrice, currentPurchasedWeightGrams, currentRoastInputGrams, selectedTemplate]);

  useEffect(() => {
    if (!autoApplyDefaultCostTemplate || !enableCostTemplateSelection || !selectedTemplate || !templatePreview) {
      return;
    }

    const shouldDirty = templateSyncShouldDirtyRef.current;
    const nextWeight = templatePreview.defaultSaleUnitWeightGrams;
    const nextPrice = templatePreview.defaultSaleUnitPrice;
    const lastAutoDefaults = lastAutoSaleDefaultsRef.current;

    if (
      !manualSaleDefaultsRef.current.weight ||
      currentDefaultSaleUnitWeightGrams == null ||
      currentDefaultSaleUnitWeightGrams === lastAutoDefaults.weight
    ) {
      setValue('defaultSaleUnitWeightGrams', nextWeight, { shouldDirty });
      lastAutoDefaults.weight = nextWeight;
    }

    if (
      !manualSaleDefaultsRef.current.price ||
      Math.abs(currentDefaultSaleUnitPrice - (lastAutoDefaults.price ?? Number.NaN)) < 0.005
    ) {
      setValue('defaultSaleUnitPrice', nextPrice, { shouldDirty });
      lastAutoDefaults.price = nextPrice;
    }
  }, [
    autoApplyDefaultCostTemplate,
    currentDefaultSaleUnitPrice,
    currentDefaultSaleUnitWeightGrams,
    enableCostTemplateSelection,
    selectedTemplate,
    setValue,
    templatePreview,
  ]);

  const submitForm = async (values: GreenBeanFormInput) => {
    clearErrors();

    const result = greenBeanCreateFormSchema.safeParse(values);

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const pathKey = issue.path.join('.');
        const fieldPath = beanFormFieldPathMap[pathKey];

        if (!fieldPath) {
          return;
        }

        setError(fieldPath, {
          message: issue.message,
          type: 'manual',
        });
      });

      const firstFieldPath = result.error.issues
        .map((issue) => beanFormFieldPathMap[issue.path.join('.')])
        .find((fieldPath): fieldPath is FieldPath<GreenBeanFormInput> => fieldPath != null);

      if (firstFieldPath) {
        window.requestAnimationFrame(() => {
          setFocus(firstFieldPath);
        });
      }

      return;
    }

    await onSubmit(result.data);

    if (resetOnSubmit) {
      reset(initialValues);
    }
  };

  const formatOptionalHelp = (message: string | undefined, fallback: string): string => {
    return getErrorMessage(message, `${fallback}，可稍后补充`);
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit((values) => {
        void submitForm(values);
      })}
    >
      <BeanIdentitySection control={control} errors={errors} optionalHelp={formatOptionalHelp} />
      <BeanPostRoastSection control={control} errors={errors} />
      <BeanQualitySection control={control} errors={errors} optionalHelp={formatOptionalHelp} />
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h3>采购与定价</h3>
          <p>这些字段会直接参与库存、成本和未来利润分析。</p>
        </header>
        <div className={styles.fieldGrid}>
          {enableCostTemplateSelection ? (
            <label className={joinClassNames(styles.field, styles.fieldWide)} data-field-path="costTemplate">
              {renderLabel('成本模板', true)}
              <Select
                aria-label="成本模板"
                onChange={(value: string | undefined) => {
                  if (!value) {
                    return;
                  }

                  templateSyncShouldDirtyRef.current = true;
                  manualSaleDefaultsRef.current = {
                    price: false,
                    weight: false,
                  };
                  setSelectedTemplateId(value);
                }}
                options={costTemplateSettings.templates.map((template) => ({
                  label: template.name,
                  value: template.id,
                }))}
                placeholder="选择一个成本模板"
                showSearch={false}
                value={selectedTemplate?.id ?? undefined}
              />
              <span className={styles.helpText}>
                {selectedTemplate
                  ? '会带入默认单次烘焙量，并根据当前采购重量与总价实时给出参考售价'
                  : autoApplyDefaultCostTemplate
                    ? '请先在设置中建立成本模板后再录入生豆'
                    : '必须选择成本模板，用于计算库存预估和销售利润'}
              </span>
              <div className={joinClassNames(styles.linkedHint, styles.inlineHint)}>
                {selectedTemplate ? (
                  <>
                    模板“{selectedTemplate.name}”当前参考值：
                    单次烘焙量 {String(currentRoastInputGrams)}g，
                    建议单份出售重量 {String(selectedTemplate.saleUnitWeightGrams)}g，
                    建议定价 ¥{templatePreview?.defaultSaleUnitPrice.toFixed(2) ?? '0.00'}。
                  </>
                ) : (
                  '选择成本模板后，会先生成最终单份出售重量、最终定价与默认单次烘焙量的参考值。'
                )}
              </div>
            </label>
          ) : null}

          <label className={styles.field} data-field-path="purchaseDate">
            {renderLabel('采购日期', true)}
            <Controller
              control={control}
              name="purchaseDate"
              render={({ field }) => (
                <AdaptiveDateTimeField
                  ariaLabel="采购日期"
                  mode="date"
                  placeholder="选择采购日期"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.purchaseDate ? styles.helpTextError : undefined)}>
              {getErrorMessage(errors.purchaseDate?.message, '会作为生豆采购支出的统计日期')}
            </span>
          </label>

          <label className={styles.field} data-field-path="purchasedWeightGrams">
            {renderLabel('购买重量', true)}
            <Controller
              control={control}
              name="purchasedWeightGrams"
              render={({ field }) => (
                <InputNumber
                  aria-label="购买重量"
                  min={1}
                  onChange={(value) => {
                    field.onChange(value ?? 0);
                  }}
                  precision={0}
                  suffix="g"
                  value={field.value}
                />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.purchasedWeightGrams ? styles.helpTextError : undefined)}>
              {getErrorMessage(errors.purchasedWeightGrams?.message, '总库存，表示本批生豆累计购买重量')}
            </span>
          </label>

          <label className={styles.field} data-field-path="remainingWeightGrams">
            {renderLabel('剩余重量', true)}
            <Controller
              control={control}
              name="remainingWeightGrams"
              render={({ field }) => (
                <InputNumber
                  aria-label="剩余重量"
                  min={0}
                  onChange={(value) => {
                    field.onChange(value ?? 0);
                  }}
                  precision={0}
                  suffix="g"
                  value={field.value}
                />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.remainingWeightGrams ? styles.helpTextError : undefined)}>
              {getErrorMessage(errors.remainingWeightGrams?.message, '剩余库存，可根据盘点结果后续手动修正')}
            </span>
          </label>

          <label className={styles.field} data-field-path="purchasedTotalPrice">
            {renderLabel('购买总价', true)}
            <Controller
              control={control}
              name="purchasedTotalPrice"
              render={({ field }) => (
                <InputNumber
                  aria-label="购买总价"
                  min={0.01}
                  onChange={(value) => {
                    field.onChange(value ?? 0);
                  }}
                  precision={2}
                  prefix="¥"
                  value={field.value > 0 ? field.value : null}
                />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.purchasedTotalPrice ? styles.helpTextError : undefined)}>
              {getErrorMessage(errors.purchasedTotalPrice?.message, '系统会据此换算当前每公斤成本')}
            </span>
          </label>

          <label className={styles.field} data-field-path="defaultSaleUnitWeightGrams">
            {renderLabel('最终单份出售重量')}
            <Controller
              control={control}
              name="defaultSaleUnitWeightGrams"
              render={({ field }) => (
                <InputNumber
                  aria-label="最终单份出售重量"
                  min={1}
                  onChange={(value) => {
                    const nextValue = toNullableNumber(value);

                    if (nextValue !== lastAutoSaleDefaultsRef.current.weight) {
                      manualSaleDefaultsRef.current.weight = true;
                    }

                    field.onChange(nextValue);
                  }}
                  precision={0}
                  suffix="g"
                  value={field.value ?? null}
                />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.defaultSaleUnitWeightGrams ? styles.helpTextError : undefined)}>
              {selectedTemplate
                ? errors.defaultSaleUnitWeightGrams?.message ??
                  `请手动填写；可参考模板建议 ${String(selectedTemplate.saleUnitWeightGrams)}g`
                : formatOptionalHelp(errors.defaultSaleUnitWeightGrams?.message, '可手动填写最终零售容量')}
            </span>
          </label>

          <label className={styles.field} data-field-path="defaultSaleUnitPrice">
            {renderLabel('最终定价', true)}
            <Controller
              control={control}
              name="defaultSaleUnitPrice"
              render={({ field }) => (
                <InputNumber
                  aria-label="最终定价"
                  min={0.01}
                  onChange={(value) => {
                    const nextValue = value ?? 0;

                    if (Math.abs(nextValue - (lastAutoSaleDefaultsRef.current.price ?? Number.NaN)) >= 0.005) {
                      manualSaleDefaultsRef.current.price = true;
                    }

                    field.onChange(nextValue);
                  }}
                  precision={2}
                  prefix="¥"
                  value={field.value}
                />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.defaultSaleUnitPrice ? styles.helpTextError : undefined)}>
              {selectedTemplate
                ? errors.defaultSaleUnitPrice?.message ??
                  `请手动填写；当前模板建议 ¥${templatePreview?.defaultSaleUnitPrice.toFixed(2) ?? '0.00'}`
                : getErrorMessage(errors.defaultSaleUnitPrice?.message, '可手动填写最终零售价')}
            </span>
          </label>

        </div>
      </section>
      <BeanNotesSection control={control} />

      <BeanFormActions onCancel={onCancel} submitLabel={submitLabel} />
    </form>
  );
}
