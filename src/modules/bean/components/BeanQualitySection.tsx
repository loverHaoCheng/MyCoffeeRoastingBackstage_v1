import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';
import styles from './BeanForm.module.css';

interface Props { control: Control<GreenBeanFormInput>; errors: FieldErrors<GreenBeanFormInput>; optionalHelp: (message: string | undefined, fallback: string) => string }
const classes = (error: boolean) => [styles.helpText, error ? styles.helpTextError : undefined].filter(Boolean).join(' ');
const label = (text: string) => <span className={styles.labelText}>{text}</span>;
const nullable = (value: null | number) => value ?? null;

export function BeanQualitySection({ control, errors, optionalHelp }: Props) {
  return <section className={styles.section}>
    <header className={styles.sectionHeader}><h3>产地与品质</h3><p>这部分字段用于后续做批次筛选、成本分析和图片识别自动回填。</p></header>
    <div className={styles.fieldGrid}>
      <label className={styles.field} data-field-path="originCountry">{label('产地国家')}<Controller control={control} name="originCountry" render={({ field }) => <Input {...field} aria-label="产地国家" placeholder="例如 埃塞俄比亚" value={field.value ?? ''} />} /><span className={classes(Boolean(errors.originCountry))}>{optionalHelp(errors.originCountry?.message, '建议使用完整国家名称')}</span></label>
      <label className={styles.field} data-field-path="originRegion">{label('产区')}<Controller control={control} name="originRegion" render={({ field }) => <Input {...field} aria-label="产区" placeholder="例如 古吉 / 涅里" value={field.value ?? ''} />} /><span className={classes(Boolean(errors.originRegion))}>{optionalHelp(errors.originRegion?.message, '主要展示在库存卡片的产地字段')}</span></label>
      <label className={styles.field} data-field-path="originArea">{label('更细分产区')}<Controller control={control} name="originArea" render={({ field }) => <Input {...field} aria-label="更细分产区" placeholder="例如 Hambela / Yirgacheffe" value={field.value ?? ''} />} /><span className={classes(Boolean(errors.originArea))}>{optionalHelp(errors.originArea?.message, '未来可作为更细颗粒度筛选条件')}</span></label>
      <label className={styles.field} data-field-path="moisturePercent">{label('含水率')}<Controller control={control} name="moisturePercent" render={({ field }) => <InputNumber aria-label="含水率" max={100} min={0.01} onChange={(value) => { field.onChange(nullable(value)); }} precision={2} suffix="%" value={field.value ?? null} />} /><span className={classes(Boolean(errors.moisturePercent))}>{optionalHelp(errors.moisturePercent?.message, '建议输入检测值')}</span></label>
      <label className={styles.field} data-field-path="altitudeMetersMin">{label('海拔下限')}<Controller control={control} name="altitudeMetersMin" render={({ field }) => <InputNumber aria-label="海拔下限" min={1} onChange={(value) => { field.onChange(nullable(value)); }} precision={0} suffix="m" value={field.value ?? null} />} /><span className={classes(Boolean(errors.altitudeMetersMin))}>{optionalHelp(errors.altitudeMetersMin?.message, '海拔区间有助于后续风味分析')}</span></label>
      <label className={styles.field} data-field-path="altitudeMetersMax">{label('海拔上限')}<Controller control={control} name="altitudeMetersMax" render={({ field }) => <InputNumber aria-label="海拔上限" min={1} onChange={(value) => { field.onChange(nullable(value)); }} precision={0} suffix="m" value={field.value ?? null} />} /><span className={classes(Boolean(errors.altitudeMetersMax))}>{optionalHelp(errors.altitudeMetersMax?.message, '若填写则需大于等于海拔下限')}</span></label>
      <label className={styles.field} data-field-path="densityGPerL">{label('密度')}<Controller control={control} name="densityGPerL" render={({ field }) => <InputNumber aria-label="密度" min={0.1} onChange={(value) => { field.onChange(nullable(value)); }} precision={1} suffix="g/L" value={field.value ?? null} />} /><span className={classes(Boolean(errors.densityGPerL))}>{optionalHelp(errors.densityGPerL?.message, '后续可用于 AI 推荐烘焙参数')}</span></label>
    </div>
  </section>;
}
