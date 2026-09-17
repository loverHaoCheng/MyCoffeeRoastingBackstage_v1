import { AdaptiveDateTimeField } from '@/shared/components/AdaptiveDateTimeField';
import InputNumber from '@/shared/components/ui/input-number';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';

import type { GreenBeanFormInput } from '../types/localGreenBean';
import styles from './BeanForm.module.css';

const getErrorMessage = (message: string | undefined, fallback: string): string => message ?? fallback;
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

interface BeanPurchasingFieldsProps {
  control: Control<GreenBeanFormInput>;
  errors: FieldErrors<GreenBeanFormInput>;
}

export function BeanPurchasingFields({ control, errors }: BeanPurchasingFieldsProps) {
  return (
    <>
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
    </>
  );
}
