import { useEffect, useMemo, useRef, useState } from 'react';
import { SaveOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Select } from 'antd';
import { Controller, type FieldPath, useForm } from 'react-hook-form';

import { greenBeanCreateFormSchema } from '@/modules/bean/schemas';
import { calculateCostMetrics } from '@/modules/finance/services';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import type { CostTemplate } from '@/modules/settings/types';

import type { GreenBeanFormInput } from '../types/localGreenBean';

import styles from './BeanForm.module.css';

const { TextArea } = Input;

interface BeanFormProps {
  autoApplyDefaultCostTemplate?: boolean;
  enableCostTemplateSelection?: boolean;
  initialValues: GreenBeanFormInput;
  onSubmit: (input: GreenBeanFormInput) => Promise<void> | void;
  resetOnSubmit?: boolean;
  submitLabel: string;
}

const fieldPathMap: Record<string, FieldPath<GreenBeanFormInput>> = {
  altitudeMetersMax: 'altitudeMetersMax',
  altitudeMetersMin: 'altitudeMetersMin',
  code: 'code',
  defaultRoastInputGrams: 'defaultRoastInputGrams',
  defaultSaleUnitPrice: 'defaultSaleUnitPrice',
  defaultSaleUnitWeightGrams: 'defaultSaleUnitWeightGrams',
  densityGPerL: 'densityGPerL',
  displayName: 'displayName',
  harvestSeason: 'harvestSeason',
  millName: 'millName',
  moisturePercent: 'moisturePercent',
  notes: 'notes',
  originArea: 'originArea',
  originCountry: 'originCountry',
  originRegion: 'originRegion',
  processMethod: 'processMethod',
  purchasedTotalPrice: 'purchasedTotalPrice',
  purchasedWeightGrams: 'purchasedWeightGrams',
  supplierName: 'supplierName',
  variety: 'variety',
};

const getErrorMessage = (message: string | undefined, fallback: string): string => {
  return message ?? fallback;
};

const toNullableNumber = (value: null | number): null | number => {
  return value == null ? null : value;
};

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

const calculateTemplateDrivenSaleDefaults = (
  template: CostTemplate,
  values: Pick<GreenBeanFormInput, 'defaultRoastInputGrams' | 'purchasedTotalPrice' | 'purchasedWeightGrams'>,
) => {
  const purchaseCostPerKg =
    values.purchasedWeightGrams > 0
      ? Number(((values.purchasedTotalPrice / values.purchasedWeightGrams) * 1000).toFixed(2))
      : 0;
  const metrics = calculateCostMetrics({
    beanId: '',
    beanName: '',
    calculationName: '',
    dehydrationRate: template.dehydrationRate,
    energyCost: template.energyCost,
    laborCost: template.laborCost,
    notes: '',
    otherCost: template.otherCost,
    packagingCost: template.packagingCost,
    purchaseCostPerKg,
    roastInputWeightGrams: values.defaultRoastInputGrams,
    saleUnitPrice: 0,
    saleUnitWeightGrams: template.saleUnitWeightGrams,
    targetProfitRate: template.targetProfitRate,
  });

  return {
    defaultSaleUnitPrice: metrics.suggestedSalePrice,
    defaultSaleUnitWeightGrams: template.saleUnitWeightGrams,
  };
};

export function BeanForm({
  autoApplyDefaultCostTemplate = false,
  enableCostTemplateSelection = false,
  initialValues,
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
    getValues,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<GreenBeanFormInput>({
    defaultValues: initialValues,
  });
  const templateSyncShouldDirtyRef = useRef(false);
  const currentRoastInputGrams = watch('defaultRoastInputGrams');
  const currentSaleUnitPrice = watch('defaultSaleUnitPrice');
  const currentSaleUnitWeightGrams = watch('defaultSaleUnitWeightGrams');
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
    if (!enableCostTemplateSelection) {
      return;
    }

    if (autoApplyDefaultCostTemplate && costTemplateSettings.defaultTemplateId) {
      templateSyncShouldDirtyRef.current = false;
      setSelectedTemplateId(costTemplateSettings.defaultTemplateId);
      return;
    }

    templateSyncShouldDirtyRef.current = false;
    setSelectedTemplateId(null);
  }, [autoApplyDefaultCostTemplate, costTemplateSettings.defaultTemplateId, enableCostTemplateSelection]);

  useEffect(() => {
    if (!enableCostTemplateSelection || !selectedTemplate) {
      return;
    }

    const shouldDirty = templateSyncShouldDirtyRef.current;
    const formValues = getValues();

    setValue('defaultRoastInputGrams', selectedTemplate.roastInputWeightGrams, { shouldDirty });

    const nextDefaults = calculateTemplateDrivenSaleDefaults(selectedTemplate, {
      defaultRoastInputGrams: selectedTemplate.roastInputWeightGrams,
      purchasedTotalPrice: formValues.purchasedTotalPrice,
      purchasedWeightGrams: formValues.purchasedWeightGrams,
    });

    setValue('defaultSaleUnitPrice', nextDefaults.defaultSaleUnitPrice, { shouldDirty });
    setValue('defaultSaleUnitWeightGrams', nextDefaults.defaultSaleUnitWeightGrams, { shouldDirty });
    templateSyncShouldDirtyRef.current = true;
  }, [enableCostTemplateSelection, getValues, selectedTemplate, setValue]);

  const submitForm = async (values: GreenBeanFormInput) => {
    clearErrors();

    const result = greenBeanCreateFormSchema.safeParse(values);

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const pathKey = issue.path.join('.');
        const fieldPath = fieldPathMap[pathKey];

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

    await onSubmit(result.data);

    if (resetOnSubmit) {
      reset(initialValues);
    }
  };

  const formatOptionalHelp = (message: string | undefined, fallback: string): string => {
    return getErrorMessage(message, `${fallback}，可稍后补充`);
  };

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(submitForm)(event)}>
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h3>基础信息</h3>
          <p>先建立生豆主档，后续烘焙方案与烘焙记录会自动关联到这条数据。</p>
        </header>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            {renderLabel('生豆编号', true)}
            <Controller
              control={control}
              name="code"
              render={({ field }) => <Input {...field} aria-label="生豆编号" placeholder="例如 GB-2026-001" />}
            />
            <span className={`${styles.helpText} ${errors.code ? styles.helpTextError : ''}`}>
              {getErrorMessage(errors.code?.message, '建议使用稳定编号，便于后续采购与烘焙关联')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('显示名称', true)}
            <Controller
              control={control}
              name="displayName"
              render={({ field }) => (
                <Input {...field} aria-label="显示名称" placeholder="例如 埃塞俄比亚 古吉 G1 水洗" />
              )}
            />
            <span className={`${styles.helpText} ${errors.displayName ? styles.helpTextError : ''}`}>
              {getErrorMessage(errors.displayName?.message, '用于库存卡片、烘焙计划和搜索结果展示')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('生豆商')}
            <Controller
              control={control}
              name="supplierName"
              render={({ field }) => (
                <Input {...field} aria-label="生豆商" placeholder="例如 Nordic Approach" value={field.value ?? ''} />
              )}
            />
            <span className={`${styles.helpText} ${errors.supplierName ? styles.helpTextError : ''}`}>
              {formatOptionalHelp(errors.supplierName?.message, '用于卡片展示和采购追溯')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('豆种', true)}
            <Controller
              control={control}
              name="variety"
              render={({ field }) => <Input {...field} aria-label="豆种" placeholder="例如 Heirloom / SL28 SL34" />}
            />
            <span className={`${styles.helpText} ${errors.variety ? styles.helpTextError : ''}`}>
              {getErrorMessage(errors.variety?.message, '可填写单一品种或多个拼接品种')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('产季')}
            <Controller
              control={control}
              name="harvestSeason"
              render={({ field }) => (
                <Input {...field} aria-label="产季" placeholder="例如 2025/26" value={field.value ?? ''} />
              )}
            />
            <span className={`${styles.helpText} ${errors.harvestSeason ? styles.helpTextError : ''}`}>
              {formatOptionalHelp(errors.harvestSeason?.message, '建议保持统一格式，方便后续筛选')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('处理法', true)}
            <Controller
              control={control}
              name="processMethod"
              render={({ field }) => <Input {...field} aria-label="处理法" placeholder="例如 水洗 / 日晒 / 厌氧" />}
            />
            <span className={`${styles.helpText} ${errors.processMethod ? styles.helpTextError : ''}`}>
              {getErrorMessage(errors.processMethod?.message, '这里会直接参与生豆页筛选')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('处理厂')}
            <Controller
              control={control}
              name="millName"
              render={({ field }) => (
                <Input
                  {...field}
                  aria-label="处理厂"
                  placeholder="例如 Halo Beriti Washing Station"
                  value={field.value ?? ''}
                />
              )}
            />
            <span className={`${styles.helpText} ${errors.millName ? styles.helpTextError : ''}`}>
              {formatOptionalHelp(errors.millName?.message, '用于保留更完整的追溯信息')}
            </span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h3>产地与品质</h3>
          <p>这部分字段用于后续做批次筛选、成本分析和图片识别自动回填。</p>
        </header>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            {renderLabel('产地国家')}
            <Controller
              control={control}
              name="originCountry"
              render={({ field }) => (
                <Input {...field} aria-label="产地国家" placeholder="例如 埃塞俄比亚" value={field.value ?? ''} />
              )}
            />
            <span className={`${styles.helpText} ${errors.originCountry ? styles.helpTextError : ''}`}>
              {formatOptionalHelp(errors.originCountry?.message, '建议使用完整国家名称')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('产区')}
            <Controller
              control={control}
              name="originRegion"
              render={({ field }) => (
                <Input {...field} aria-label="产区" placeholder="例如 古吉 / 涅里" value={field.value ?? ''} />
              )}
            />
            <span className={`${styles.helpText} ${errors.originRegion ? styles.helpTextError : ''}`}>
              {formatOptionalHelp(errors.originRegion?.message, '主要展示在库存卡片的产地字段')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('更细分产区')}
            <Controller
              control={control}
              name="originArea"
              render={({ field }) => (
                <Input
                  {...field}
                  aria-label="更细分产区"
                  placeholder="例如 Hambela / Yirgacheffe"
                  value={field.value ?? ''}
                />
              )}
            />
            <span className={`${styles.helpText} ${errors.originArea ? styles.helpTextError : ''}`}>
              {formatOptionalHelp(errors.originArea?.message, '未来可作为更细颗粒度筛选条件')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('含水率')}
            <Controller
              control={control}
              name="moisturePercent"
              render={({ field }) => (
                <InputNumber
                  aria-label="含水率"
                  max={100}
                  min={0}
                  onChange={(value) => {
                    field.onChange(toNullableNumber(value));
                  }}
                  precision={2}
                  suffix="%"
                  value={field.value ?? null}
                />
              )}
            />
            <span className={`${styles.helpText} ${errors.moisturePercent ? styles.helpTextError : ''}`}>
              {formatOptionalHelp(errors.moisturePercent?.message, '建议输入检测值')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('海拔下限')}
            <Controller
              control={control}
              name="altitudeMetersMin"
              render={({ field }) => (
                <InputNumber
                  aria-label="海拔下限"
                  min={0}
                  onChange={(value) => {
                    field.onChange(toNullableNumber(value));
                  }}
                  precision={0}
                  suffix="m"
                  value={field.value ?? null}
                />
              )}
            />
            <span className={`${styles.helpText} ${errors.altitudeMetersMin ? styles.helpTextError : ''}`}>
              {formatOptionalHelp(errors.altitudeMetersMin?.message, '海拔区间有助于后续风味分析')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('海拔上限')}
            <Controller
              control={control}
              name="altitudeMetersMax"
              render={({ field }) => (
                <InputNumber
                  aria-label="海拔上限"
                  min={0}
                  onChange={(value) => {
                    field.onChange(toNullableNumber(value));
                  }}
                  precision={0}
                  suffix="m"
                  value={field.value ?? null}
                />
              )}
            />
            <span className={`${styles.helpText} ${errors.altitudeMetersMax ? styles.helpTextError : ''}`}>
              {formatOptionalHelp(errors.altitudeMetersMax?.message, '若填写则需大于等于海拔下限')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('密度')}
            <Controller
              control={control}
              name="densityGPerL"
              render={({ field }) => (
                <InputNumber
                  aria-label="密度"
                  min={0}
                  onChange={(value) => {
                    field.onChange(toNullableNumber(value));
                  }}
                  precision={1}
                  suffix="g/L"
                  value={field.value ?? null}
                />
              )}
            />
            <span className={`${styles.helpText} ${errors.densityGPerL ? styles.helpTextError : ''}`}>
              {formatOptionalHelp(errors.densityGPerL?.message, '后续可用于 AI 推荐烘焙参数')}
            </span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h3>采购与定价</h3>
          <p>这些字段会直接参与库存、成本和未来利润分析。</p>
        </header>
        <div className={styles.fieldGrid}>
          {enableCostTemplateSelection ? (
            <label className={`${styles.field} ${styles.fieldWide}`}>
              {renderLabel('成本模板', autoApplyDefaultCostTemplate)}
              <Select
                aria-label="成本模板"
                allowClear={!autoApplyDefaultCostTemplate}
                onChange={(value) => {
                  templateSyncShouldDirtyRef.current = true;
                  setSelectedTemplateId(value ?? null);
                }}
                options={costTemplateSettings.templates.map((template) => ({
                  label: template.name,
                  value: template.id,
                }))}
                placeholder="选择一个成本模板"
                value={selectedTemplate?.id ?? undefined}
              />
              <span className={styles.helpText}>
                {selectedTemplate
                  ? '会先带入参考烘焙量、参考零售规格和参考定价，后续仍可手动修改'
                  : autoApplyDefaultCostTemplate
                    ? '请先在设置中建立成本模板'
                    : '如需重算默认规格和售价，可在这里选择成本模板'}
              </span>
              <div className={`${styles.linkedHint} ${styles.inlineHint}`}>
                {selectedTemplate ? (
                  <>
                    已根据模板“{selectedTemplate.name}”生成参考值：
                    单次烘焙量 {currentRoastInputGrams}g，
                    最终单份出售重量 {currentSaleUnitWeightGrams ?? '-'}g，
                    最终定价 ¥{currentSaleUnitPrice.toFixed(2)}。
                  </>
                ) : (
                  '选择成本模板后，会先生成最终单份出售重量、最终定价与默认单次烘焙量的参考值。'
                )}
              </div>
            </label>
          ) : null}

          <label className={styles.field}>
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
            <span className={`${styles.helpText} ${errors.purchasedWeightGrams ? styles.helpTextError : ''}`}>
              {getErrorMessage(errors.purchasedWeightGrams?.message, '用于初始化当前可用库存')}
            </span>
          </label>

          <label className={styles.field}>
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
                  value={field.value}
                />
              )}
            />
            <span className={`${styles.helpText} ${errors.purchasedTotalPrice ? styles.helpTextError : ''}`}>
              {getErrorMessage(errors.purchasedTotalPrice?.message, '系统会据此换算当前每公斤成本')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('最终单份出售重量')}
            <Controller
              control={control}
              name="defaultSaleUnitWeightGrams"
              render={({ field }) => (
                <InputNumber
                  aria-label="最终单份出售重量"
                  min={1}
                  onChange={(value) => {
                    field.onChange(toNullableNumber(value));
                  }}
                  precision={0}
                  suffix="g"
                  value={field.value ?? null}
                />
              )}
            />
            <span className={`${styles.helpText} ${errors.defaultSaleUnitWeightGrams ? styles.helpTextError : ''}`}>
              {selectedTemplate
                ? errors.defaultSaleUnitWeightGrams?.message ?? '可参考模板结果手动填写，会作为熟豆容量同步'
                : formatOptionalHelp(errors.defaultSaleUnitWeightGrams?.message, '可手动填写最终零售容量')}
            </span>
          </label>

          <label className={styles.field}>
            {renderLabel('最终定价', true)}
            <Controller
              control={control}
              name="defaultSaleUnitPrice"
              render={({ field }) => (
                <InputNumber
                  aria-label="最终定价"
                  min={0.01}
                  onChange={(value) => {
                    field.onChange(value ?? 0);
                  }}
                  precision={2}
                  prefix="¥"
                  value={field.value}
                />
              )}
            />
            <span className={`${styles.helpText} ${errors.defaultSaleUnitPrice ? styles.helpTextError : ''}`}>
              {selectedTemplate
                ? errors.defaultSaleUnitPrice?.message ?? '可参考模板结果手动填写，会作为熟豆价格同步'
                : getErrorMessage(errors.defaultSaleUnitPrice?.message, '可手动填写最终零售价')}
            </span>
          </label>

        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h3>补充说明</h3>
          <p>这里预留给杯测、批次备注和未来 AI 图像识别回填结果。</p>
        </header>
        <label className={styles.notesField}>
          {renderLabel('备注')}
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <TextArea
                {...field}
                aria-label="备注"
                autoSize={{ minRows: 4, maxRows: 8 }}
                placeholder="例如 到港时间、杯测要点、特殊批次说明"
                value={field.value ?? ''}
              />
            )}
          />
        </label>
        <div className={styles.linkedHint}>烘焙方案、烘焙记录不会在这里手动填写，创建生豆后会在烘焙模块继续关联。</div>
      </section>

      <div className={styles.actions}>
        <Button block htmlType="submit" icon={<SaveOutlined />} type="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
