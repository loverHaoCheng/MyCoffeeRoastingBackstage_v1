import Input from 'antd/es/input';
import Select from 'antd/es/select';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';
import { beanFlavorTagMaxCount, beanFlavorTagTokenSeparators, normalizeFlavorTags } from '@/modules/bean/utils/flavorTags';
import styles from './BeanForm.module.css';

interface Props { control: Control<GreenBeanFormInput>; errors: FieldErrors<GreenBeanFormInput>; optionalHelp: (message: string | undefined, fallback: string) => string }
const classes = (error: boolean) => [styles.helpText, error ? styles.helpTextError : undefined].filter(Boolean).join(' ');
const label = (text: string, required = false) => <span className={styles.labelText}>{text}{required ? <em aria-hidden="true" className={styles.requiredMark}>*</em> : null}</span>;

export function BeanIdentitySection({ control, errors, optionalHelp }: Props) {
  return <section className={styles.section}>
    <header className={styles.sectionHeader}><h3>基础信息</h3><p>先建立生豆主档，后续烘焙方案与烘焙记录会自动关联到这条数据。</p></header>
    <div className={styles.fieldGrid}>
      <label className={styles.field} data-field-path="code">{label('生豆编号', true)}<Controller control={control} name="code" render={({ field }) => <Input {...field} aria-label="生豆编号" placeholder="例如 GB-2026-001" />} /><span className={classes(Boolean(errors.code))}>{errors.code?.message ?? '建议使用稳定编号，便于后续采购与烘焙关联'}</span></label>
      <label className={styles.field} data-field-path="displayName">{label('显示名称', true)}<Controller control={control} name="displayName" render={({ field }) => <Input {...field} aria-label="显示名称" placeholder="例如 埃塞俄比亚 古吉 G1 水洗" />} /><span className={classes(Boolean(errors.displayName))}>{errors.displayName?.message ?? '用于库存卡片、烘焙计划和搜索结果展示'}</span></label>
      <label className={[styles.field, styles.fieldWide].filter(Boolean).join(' ')} data-field-path="flavorTags">{label('风味')}<Controller control={control} name="flavorTags" render={({ field }) => <Select aria-label="风味" mode="tags" onChange={(value) => { field.onChange(normalizeFlavorTags(value)); }} open={false} placeholder="输入后按回车生成标签，也支持逗号分隔" tokenSeparators={beanFlavorTagTokenSeparators} value={field.value} />} /><span className={classes(Boolean(errors.flavorTags))}>{errors.flavorTags?.message ?? `用于长期风味标签、卡片展示、搜索筛选与熟豆镜像同步，最多 ${String(beanFlavorTagMaxCount)} 个`}</span></label>
      <label className={styles.field} data-field-path="supplierName">{label('生豆商')}<Controller control={control} name="supplierName" render={({ field }) => <Input {...field} aria-label="生豆商" placeholder="例如 Nordic Approach" value={field.value ?? ''} />} /><span className={classes(Boolean(errors.supplierName))}>{optionalHelp(errors.supplierName?.message, '用于卡片展示和采购追溯')}</span></label>
      <label className={styles.field} data-field-path="variety">{label('豆种', true)}<Controller control={control} name="variety" render={({ field }) => <Input {...field} aria-label="豆种" placeholder="例如 Heirloom / SL28 SL34" />} /><span className={classes(Boolean(errors.variety))}>{errors.variety?.message ?? '可填写单一品种或多个拼接品种'}</span></label>
      <label className={styles.field} data-field-path="grade">{label('等级')}<Controller control={control} name="grade" render={({ field }) => <Input {...field} aria-label="等级" placeholder="例如 G1 / SHB / AA" value={field.value ?? ''} />} /><span className={classes(Boolean(errors.grade))}>{optionalHelp(errors.grade?.message, '可填写供应商等级、杯测等级或贸易分级')}</span></label>
      <label className={styles.field} data-field-path="harvestSeason">{label('产季')}<Controller control={control} name="harvestSeason" render={({ field }) => <Input {...field} aria-label="产季" placeholder="例如 2025/26" value={field.value ?? ''} />} /><span className={classes(Boolean(errors.harvestSeason))}>{optionalHelp(errors.harvestSeason?.message, '建议保持统一格式，方便后续筛选')}</span></label>
      <label className={styles.field} data-field-path="processMethod">{label('处理法', true)}<Controller control={control} name="processMethod" render={({ field }) => <Input {...field} aria-label="处理法" placeholder="例如 水洗 / 日晒 / 厌氧" />} /><span className={classes(Boolean(errors.processMethod))}>{errors.processMethod?.message ?? '这里会直接参与生豆页筛选'}</span></label>
      <label className={styles.field} data-field-path="millName">{label('处理厂')}<Controller control={control} name="millName" render={({ field }) => <Input {...field} aria-label="处理厂" placeholder="例如 Halo Beriti Washing Station" value={field.value ?? ''} />} /><span className={classes(Boolean(errors.millName))}>{optionalHelp(errors.millName?.message, '用于保留更完整的追溯信息')}</span></label>
    </div>
  </section>;
}
