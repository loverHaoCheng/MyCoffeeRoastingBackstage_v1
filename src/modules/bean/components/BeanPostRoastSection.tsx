import InputNumber from '@/shared/components/ui/input-number';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';

import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';

import styles from './BeanForm.module.css';

interface BeanPostRoastSectionProps {
  control: Control<GreenBeanFormInput>;
  errors: FieldErrors<GreenBeanFormInput>;
}

const renderLabel = (label: string) => <span className={styles.labelText}>{label}</span>;
const getClassName = (hasError: boolean): string => {
  return [styles.helpText, hasError ? styles.helpTextError : undefined].filter(Boolean).join(' ');
};

export function BeanPostRoastSection({ control, errors }: BeanPostRoastSectionProps) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h3>烘焙后处理</h3>
        <p>用于熟豆镜像里的养豆与赏味窗口，也可作为日常查看和后续筛选参考。</p>
      </header>
      <div className={styles.fieldGrid}>
        <label className={styles.field} data-field-path="agingDays">
          {renderLabel('养豆时间')}
          <Controller control={control} name="agingDays" render={({ field }) => <InputNumber aria-label="养豆时间" min={0} onChange={(value) => { field.onChange(value ?? 0); }} precision={0} suffix="天" value={field.value} />} />
          <span className={getClassName(Boolean(errors.agingDays))}>{errors.agingDays?.message ?? '默认 14 天，会同步到熟豆镜像的 startDay'}</span>
        </label>
        <label className={styles.field} data-field-path="tastingEndDays">
          {renderLabel('赏味结束期')}
          <Controller control={control} name="tastingEndDays" render={({ field }) => <InputNumber aria-label="赏味结束期" min={1} onChange={(value) => { field.onChange(value ?? 40); }} precision={0} suffix="天" value={field.value} />} />
          <span className={getClassName(Boolean(errors.tastingEndDays))}>{errors.tastingEndDays?.message ?? '默认 40 天，会同步到熟豆镜像的 endDay'}</span>
        </label>
      </div>
    </section>
  );
}
