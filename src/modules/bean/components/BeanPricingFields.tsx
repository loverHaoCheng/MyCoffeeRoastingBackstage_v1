import InputNumber from '@/shared/components/ui/input-number';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';

import type { CostTemplate } from '@/modules/settings/types';
import type { GreenBeanFormInput } from '../types/localGreenBean';
import styles from './BeanForm.module.css';

const joinClassNames = (...classNames: (string | undefined)[]): string => classNames.filter(Boolean).join(' ');
const toNullableNumber = (value: null | number): null | number => value ?? null;

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

interface BeanPricingFieldsProps {
  control: Control<GreenBeanFormInput>;
  errors: FieldErrors<GreenBeanFormInput>;
  selectedTemplate: CostTemplate | null;
  templatePreview: {
    errorMessage: string | null;
    values: { defaultSaleUnitPrice: number; defaultSaleUnitWeightGrams: number } | null;
  };
  onWeightChange: (value: number | null) => void;
  onPriceChange: (value: number) => void;
}

export function BeanPricingFields({
  control,
  errors,
  selectedTemplate,
  templatePreview,
  onWeightChange,
  onPriceChange,
}: BeanPricingFieldsProps) {
  const formatOptionalHelp = (message: string | undefined, fallback: string): string => {
    return message ?? `${fallback}，可稍后补充`;
  };

  return (
    <>
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
                onWeightChange(toNullableNumber(value));
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
                onPriceChange(value ?? 0);
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
              (templatePreview.errorMessage ??
                `请手动填写；当前模板建议 ¥${templatePreview.values?.defaultSaleUnitPrice.toFixed(2) ?? '0.00'}`)
            : errors.defaultSaleUnitPrice?.message ?? '可手动填写最终零售价'}
        </span>
      </label>
    </>
  );
}
