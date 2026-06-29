import { Button, Input, InputNumber, Select } from 'antd';
import { useEffect, useMemo } from 'react';
import { Controller, type FieldPath, useForm } from 'react-hook-form';

import { costCalculationFormSchema } from '@/modules/finance/schemas';
import { calculateCostMetrics } from '@/modules/finance/services';
import type { CostCalculationFormInput } from '@/modules/finance/types';
import type { Bean } from '@/types/domain';

import styles from './CostCalculatorForm.module.css';

const { TextArea } = Input;

interface CostCalculatorFormProps {
  beans: Bean[];
  canSave: boolean;
  isSaving: boolean;
  onSubmit: (input: CostCalculationFormInput) => Promise<void>;
}

const fieldPathMap: Record<string, FieldPath<CostCalculationFormInput>> = {
  beanId: 'beanId',
  beanName: 'beanName',
  calculationName: 'calculationName',
  dehydrationRate: 'dehydrationRate',
  energyCost: 'energyCost',
  laborCost: 'laborCost',
  notes: 'notes',
  otherCost: 'otherCost',
  packagingCost: 'packagingCost',
  purchaseCostPerKg: 'purchaseCostPerKg',
  roastInputWeightGrams: 'roastInputWeightGrams',
  saleUnitPrice: 'saleUnitPrice',
  saleUnitWeightGrams: 'saleUnitWeightGrams',
  targetProfitRate: 'targetProfitRate',
};

const defaultValues: CostCalculationFormInput = {
  beanId: '',
  beanName: '',
  calculationName: '',
  dehydrationRate: 14,
  energyCost: 0,
  laborCost: 0,
  notes: '',
  otherCost: 0,
  packagingCost: 0,
  purchaseCostPerKg: 0,
  roastInputWeightGrams: 200,
  saleUnitPrice: 0,
  saleUnitWeightGrams: 100,
  targetProfitRate: 30,
};

const getHelpText = (message: string | undefined, fallback: string): string => {
  return message ?? fallback;
};

export function CostCalculatorForm({
  beans,
  canSave,
  isSaving,
  onSubmit,
}: CostCalculatorFormProps) {
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    setError,
    setValue,
    watch,
  } = useForm<CostCalculationFormInput>({
    defaultValues,
  });

  const beanId = watch('beanId');
  const selectedBean = useMemo(() => beans.find((bean) => String(bean.id) === beanId) ?? null, [beanId, beans]);
  const watchedValues = watch();
  const metrics = useMemo(() => calculateCostMetrics(watchedValues), [watchedValues]);

  useEffect(() => {
    if (!selectedBean) {
      return;
    }

    setValue('beanName', selectedBean.name, { shouldDirty: true });
    setValue('calculationName', `${selectedBean.name} 单锅核算`, { shouldDirty: true });
    setValue('purchaseCostPerKg', selectedBean.costPerKg, { shouldDirty: true });
    setValue('roastInputWeightGrams', selectedBean.defaultRoastInputGrams ?? 200, { shouldDirty: true });
    setValue('saleUnitWeightGrams', selectedBean.defaultSaleUnitWeightGrams ?? 100, { shouldDirty: true });
    setValue('saleUnitPrice', 0, { shouldDirty: true });
  }, [selectedBean, setValue]);

  const submitForm = async (values: CostCalculationFormInput) => {
    clearErrors();
    const parsed = costCalculationFormSchema.safeParse(values);

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const fieldPath = fieldPathMap[issue.path.join('.')];

        if (!fieldPath) {
          return;
        }

        setError(fieldPath, {
          message: issue.message,
          type: 'manual',
        });
      });
      return;
    }

    await onSubmit({
      ...parsed.data,
      saleUnitPrice: calculateCostMetrics(parsed.data).suggestedSalePrice,
    });
  };

  return (
    <form className={styles.panel} onSubmit={(event) => void handleSubmit(submitForm)(event)}>
      <header className={styles.header}>
        <h2>单锅熟豆成本核算</h2>
        <p>从生豆主档带入基础成本与默认规格，补充本次烘焙因子后，快速得到单锅总成本、单份成本和建议售价。</p>
      </header>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>生豆与核算基础</h3>
        <div className={styles.fieldGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>选择生豆</span>
            <Controller
              control={control}
              name="beanId"
              render={({ field }) => (
                <Select
                  aria-label="选择生豆"
                  options={beans.map((bean) => ({
                    label: `${bean.name} · ${bean.origin || '待补产地'}`,
                    value: String(bean.id),
                  }))}
                  placeholder="从生豆库存选择一条记录"
                  showSearch
                  value={field.value || undefined}
                  onChange={(value) => {
                    field.onChange(value);
                  }}
                />
              )}
            />
            <span className={`${styles.helpText} ${errors.beanId ? styles.errorText : ''}`}>
              {getHelpText(errors.beanId?.message, '自动带入成本和默认规格')}
            </span>
          </label>

          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>核算名称</span>
            <Controller
              control={control}
              name="calculationName"
              render={({ field }) => <Input {...field} aria-label="核算名称" placeholder="例如 古吉水洗 100g 零售核算" />}
            />
            <span className={`${styles.helpText} ${errors.calculationName ? styles.errorText : ''}`}>
              {getHelpText(errors.calculationName?.message, '建议按用途或规格命名')}
            </span>
          </label>
        </div>

        <div className={styles.compactGrid}>
          <label className={styles.field}>
            <span>生豆成本</span>
            <Controller
              control={control}
              name="purchaseCostPerKg"
              render={({ field }) => (
                <InputNumber aria-label="生豆成本" min={0.01} precision={2} prefix="¥" suffix="/kg" value={field.value} onChange={(value) => field.onChange(value ?? 0)} />
              )}
            />
            <span className={`${styles.helpText} ${errors.purchaseCostPerKg ? styles.errorText : ''}`}>
              {getHelpText(errors.purchaseCostPerKg?.message, '默认带入，可改')}
            </span>
          </label>

          <label className={styles.field}>
            <span>脱水率</span>
            <Controller
              control={control}
              name="dehydrationRate"
              render={({ field }) => (
                <InputNumber aria-label="脱水率" min={0} max={100} precision={1} suffix="%" value={field.value} onChange={(value) => field.onChange(value ?? 0)} />
              )}
            />
            <span className={`${styles.helpText} ${errors.dehydrationRate ? styles.errorText : ''}`}>
              {getHelpText(errors.dehydrationRate?.message, '用于推算出豆量')}
            </span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>单锅成本因子</h3>
        <div className={styles.compactGrid}>
          {[
            { label: '单锅生豆重量', name: 'roastInputWeightGrams', suffix: 'g' },
            { label: '包装费用', name: 'packagingCost', prefix: '¥', precision: 2 },
            { label: '能耗费用', name: 'energyCost', prefix: '¥', precision: 2 },
            { label: '人工费用', name: 'laborCost', prefix: '¥', precision: 2 },
            { label: '其他费用', name: 'otherCost', prefix: '¥', precision: 2 },
            { label: '目标利润率', name: 'targetProfitRate', suffix: '%', precision: 1 },
          ].map((item) => (
            <label className={styles.field} key={item.name}>
              <span>{item.label}</span>
              <Controller
                control={control}
                name={item.name as FieldPath<CostCalculationFormInput>}
                render={({ field }) => (
                  <InputNumber
                    aria-label={item.label}
                    min={0}
                    precision={item.precision ?? 0}
                    prefix={item.prefix}
                    suffix={item.suffix}
                    value={field.value as number}
                    onChange={(value) => field.onChange(value ?? 0)}
                  />
                )}
              />
              <span className={`${styles.helpText} ${errors[item.name as keyof typeof errors] ? styles.errorText : ''}`}>
                {getHelpText(
                  errors[item.name as keyof typeof errors]?.message as string | undefined,
                  item.name === 'roastInputWeightGrams' ? '建议与主档保持一致' : '实时计入总成本',
                )}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>单份规格设置</h3>
        <div className={styles.compactGrid}>
          <label className={styles.field}>
            <span>单份熟豆重量</span>
            <Controller
              control={control}
              name="saleUnitWeightGrams"
              render={({ field }) => (
                <InputNumber aria-label="单份熟豆重量" min={1} precision={0} suffix="g" value={field.value} onChange={(value) => field.onChange(value ?? 0)} />
              )}
            />
            <span className={`${styles.helpText} ${errors.saleUnitWeightGrams ? styles.errorText : ''}`}>
              {getHelpText(errors.saleUnitWeightGrams?.message, '默认带入规格')}
            </span>
          </label>
        </div>

        <div className={styles.fieldGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>备注</span>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <TextArea {...field} aria-label="成本备注" autoSize={{ minRows: 3, maxRows: 6 }} placeholder="例如：袋材升级、节日礼盒、不同门店人工分摊规则" value={field.value ?? ''} />
              )}
            />
            <span className={`${styles.helpText} ${errors.notes ? styles.errorText : ''}`}>
              {getHelpText(errors.notes?.message, '保存本次核算说明')}
            </span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>实时核算结果</h3>
        <div className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span>单锅生豆成本</span>
            <strong>¥{metrics.greenBeanCost.toFixed(2)}</strong>
            <p>由生豆单价与单锅生豆重量自动换算。</p>
          </article>
          <article className={styles.summaryCard}>
            <span>单锅总成本</span>
            <strong>¥{metrics.totalBatchCost.toFixed(2)}</strong>
            <p>包含生豆、包装、能耗、人工与其他费用。</p>
          </article>
          <article className={styles.summaryCard}>
            <span>建议售价</span>
            <strong>¥{metrics.suggestedSalePrice.toFixed(2)}</strong>
            <p>按目标利润率 {watchedValues.targetProfitRate.toFixed(1)}% 估算。</p>
          </article>
          <article className={styles.summaryCard}>
            <span>单份利润</span>
            <strong>¥{metrics.profitPerSaleUnit.toFixed(2)}</strong>
            <p>按建议售价计算，利润率 {metrics.profitRate.toFixed(1)}%。</p>
          </article>
        </div>
      </section>

      <div className={styles.actions}>
        <Button block disabled={!canSave} htmlType="submit" loading={isSaving} type="primary">
          保存本次核算
        </Button>
      </div>
    </form>
  );
}
