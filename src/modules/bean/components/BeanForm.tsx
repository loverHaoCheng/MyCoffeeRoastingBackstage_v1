import { useEffect, useMemo, useRef, useState } from 'react';
import { SaveOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Select } from 'antd';
import { Controller, type FieldPath, useForm } from 'react-hook-form';

import { greenBeanCreateFormSchema } from '@/modules/bean/schemas';
import { calculateCostMetrics } from '@/modules/finance/services';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import type { CostTemplate } from '@/modules/settings/types';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { scrollToField } from '@/shared/forms/scrollToField';

import type { GreenBeanFormInput } from '../types/localGreenBean';

import styles from './BeanForm.module.css';

const { TextArea } = Input;

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

const fieldPathMap: Record<string, FieldPath<GreenBeanFormInput>> = {
  altitudeMetersMax: 'altitudeMetersMax',
  altitudeMetersMin: 'altitudeMetersMin',
  code: 'code',
  defaultRoastInputGrams: 'defaultRoastInputGrams',
  defaultSaleUnitPrice: 'defaultSaleUnitPrice',
  defaultSaleUnitWeightGrams: 'defaultSaleUnitWeightGrams',
  densityGPerL: 'densityGPerL',
  displayName: 'displayName',
  grade: 'grade',
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
  remainingWeightGrams: 'remainingWeightGrams',
  supplierName: 'supplierName',
  variety: 'variety',
};

const getErrorMessage = (message: string | undefined, fallback: string): string => {
  return message ?? fallback;
};

const toNullableNumber = (value: null | number): null | number => {
  return value ?? null;
};

const joinClassNames = (...classNames: (string | undefined)[]): string => {
  return classNames.filter(Boolean).join(' ');
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
  const currentRoastInputGrams = watch('defaultRoastInputGrams');
  const currentPurchasedTotalPrice = watch('purchasedTotalPrice');
  const currentPurchasedWeightGrams = watch('purchasedWeightGrams');
  const currentRemainingWeightGrams = watch('remainingWeightGrams');
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
    templateSyncShouldDirtyRef.current = false;
    setSelectedTemplateId(
      enableCostTemplateSelection && autoApplyDefaultCostTemplate ? costTemplateSettings.defaultTemplateId ?? null : null,
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

      const firstFieldPath = result.error.issues
        .map((issue) => fieldPathMap[issue.path.join('.')])
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
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h3>基础信息</h3>
          <p>先建立生豆主档，后续烘焙方案与烘焙记录会自动关联到这条数据。</p>
        </header>
        <div className={styles.fieldGrid}>
          <label className={styles.field} data-field-path="code">
            {renderLabel('生豆编号', true)}
            <Controller
              control={control}
              name="code"
              render={({ field }) => <Input {...field} aria-label="生豆编号" placeholder="例如 GB-2026-001" />}
            />
            <span className={joinClassNames(styles.helpText, errors.code ? styles.helpTextError : undefined)}>
              {getErrorMessage(errors.code?.message, '建议使用稳定编号，便于后续采购与烘焙关联')}
            </span>
          </label>

          <label className={styles.field} data-field-path="displayName">
            {renderLabel('显示名称', true)}
            <Controller
              control={control}
              name="displayName"
              render={({ field }) => (
                <Input {...field} aria-label="显示名称" placeholder="例如 埃塞俄比亚 古吉 G1 水洗" />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.displayName ? styles.helpTextError : undefined)}>
              {getErrorMessage(errors.displayName?.message, '用于库存卡片、烘焙计划和搜索结果展示')}
            </span>
          </label>

          <label className={styles.field} data-field-path="supplierName">
            {renderLabel('生豆商')}
            <Controller
              control={control}
              name="supplierName"
              render={({ field }) => (
                <Input {...field} aria-label="生豆商" placeholder="例如 Nordic Approach" value={field.value ?? ''} />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.supplierName ? styles.helpTextError : undefined)}>
              {formatOptionalHelp(errors.supplierName?.message, '用于卡片展示和采购追溯')}
            </span>
          </label>

          <label className={styles.field} data-field-path="variety">
            {renderLabel('豆种', true)}
            <Controller
              control={control}
              name="variety"
              render={({ field }) => <Input {...field} aria-label="豆种" placeholder="例如 Heirloom / SL28 SL34" />}
            />
            <span className={joinClassNames(styles.helpText, errors.variety ? styles.helpTextError : undefined)}>
              {getErrorMessage(errors.variety?.message, '可填写单一品种或多个拼接品种')}
            </span>
          </label>

          <label className={styles.field} data-field-path="grade">
            {renderLabel('等级')}
            <Controller
              control={control}
              name="grade"
              render={({ field }) => (
                <Input {...field} aria-label="等级" placeholder="例如 G1 / SHB / AA" value={field.value ?? ''} />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.grade ? styles.helpTextError : undefined)}>
              {formatOptionalHelp(errors.grade?.message, '可填写供应商等级、杯测等级或贸易分级')}
            </span>
          </label>

          <label className={styles.field} data-field-path="harvestSeason">
            {renderLabel('产季')}
            <Controller
              control={control}
              name="harvestSeason"
              render={({ field }) => (
                <Input {...field} aria-label="产季" placeholder="例如 2025/26" value={field.value ?? ''} />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.harvestSeason ? styles.helpTextError : undefined)}>
              {formatOptionalHelp(errors.harvestSeason?.message, '建议保持统一格式，方便后续筛选')}
            </span>
          </label>

          <label className={styles.field} data-field-path="processMethod">
            {renderLabel('处理法', true)}
            <Controller
              control={control}
              name="processMethod"
              render={({ field }) => <Input {...field} aria-label="处理法" placeholder="例如 水洗 / 日晒 / 厌氧" />}
            />
            <span className={joinClassNames(styles.helpText, errors.processMethod ? styles.helpTextError : undefined)}>
              {getErrorMessage(errors.processMethod?.message, '这里会直接参与生豆页筛选')}
            </span>
          </label>

          <label className={styles.field} data-field-path="millName">
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
            <span className={joinClassNames(styles.helpText, errors.millName ? styles.helpTextError : undefined)}>
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
          <label className={styles.field} data-field-path="originCountry">
            {renderLabel('产地国家')}
            <Controller
              control={control}
              name="originCountry"
              render={({ field }) => (
                <Input {...field} aria-label="产地国家" placeholder="例如 埃塞俄比亚" value={field.value ?? ''} />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.originCountry ? styles.helpTextError : undefined)}>
              {formatOptionalHelp(errors.originCountry?.message, '建议使用完整国家名称')}
            </span>
          </label>

          <label className={styles.field} data-field-path="originRegion">
            {renderLabel('产区')}
            <Controller
              control={control}
              name="originRegion"
              render={({ field }) => (
                <Input {...field} aria-label="产区" placeholder="例如 古吉 / 涅里" value={field.value ?? ''} />
              )}
            />
            <span className={joinClassNames(styles.helpText, errors.originRegion ? styles.helpTextError : undefined)}>
              {formatOptionalHelp(errors.originRegion?.message, '主要展示在库存卡片的产地字段')}
            </span>
          </label>

          <label className={styles.field} data-field-path="originArea">
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
            <span className={joinClassNames(styles.helpText, errors.originArea ? styles.helpTextError : undefined)}>
              {formatOptionalHelp(errors.originArea?.message, '未来可作为更细颗粒度筛选条件')}
            </span>
          </label>

          <label className={styles.field} data-field-path="moisturePercent">
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
            <span className={joinClassNames(styles.helpText, errors.moisturePercent ? styles.helpTextError : undefined)}>
              {formatOptionalHelp(errors.moisturePercent?.message, '建议输入检测值')}
            </span>
          </label>

          <label className={styles.field} data-field-path="altitudeMetersMin">
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
            <span className={joinClassNames(styles.helpText, errors.altitudeMetersMin ? styles.helpTextError : undefined)}>
              {formatOptionalHelp(errors.altitudeMetersMin?.message, '海拔区间有助于后续风味分析')}
            </span>
          </label>

          <label className={styles.field} data-field-path="altitudeMetersMax">
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
            <span className={joinClassNames(styles.helpText, errors.altitudeMetersMax ? styles.helpTextError : undefined)}>
              {formatOptionalHelp(errors.altitudeMetersMax?.message, '若填写则需大于等于海拔下限')}
            </span>
          </label>

          <label className={styles.field} data-field-path="densityGPerL">
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
            <span className={joinClassNames(styles.helpText, errors.densityGPerL ? styles.helpTextError : undefined)}>
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
            <label className={joinClassNames(styles.field, styles.fieldWide)} data-field-path="costTemplate">
              {renderLabel('成本模板')}
              <Select
                aria-label="成本模板"
                allowClear={!autoApplyDefaultCostTemplate}
                onChange={(value: string | undefined) => {
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
                  ? '会带入默认单次烘焙量，并根据当前采购重量与总价实时给出参考售价'
                  : autoApplyDefaultCostTemplate
                    ? '请先在设置中建立成本模板'
                    : '如需重算默认规格和售价，可在这里选择成本模板'}
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
                  value={field.value}
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
                    field.onChange(toNullableNumber(value));
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
                    field.onChange(value ?? 0);
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

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h3>补充说明</h3>
          <p>这里预留给杯测、批次备注和未来 AI 图像识别回填结果。</p>
        </header>
        <label className={styles.notesField} data-field-path="notes">
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

      <DrawerActionBar compact>
        {onCancel ? (
          <Button block onClick={onCancel}>
            取消
          </Button>
        ) : null}
        <Button block htmlType="submit" icon={<SaveOutlined />} type="primary">
          {submitLabel}
        </Button>
      </DrawerActionBar>
    </form>
  );
}
