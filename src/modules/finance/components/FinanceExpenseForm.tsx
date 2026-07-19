import SaveOutlined from '@ant-design/icons/SaveOutlined';
import Button from "antd/es/button";
import AntdSelect from 'antd/es/select';
import { useMemo } from 'react';
import { Select } from '@/components/ui/select';
import { AdaptiveDateTimeField } from '@/shared/components/AdaptiveDateTimeField';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';
import { Controller, type FieldPath, useForm, useWatch } from 'react-hook-form';

import { financeExpenseFormSchema } from '@/modules/finance/schemas';
import {
  buildCostTemplateById,
  buildReservedShippingUnitCountByBatchId,
  calculateRoastSaleCapacity,
  resolveBeanCostTemplate,
} from '@/modules/finance/services/financeProfitCalculation.service';
import type { FinanceExpenseFormInput, FinanceExpenseRecord } from '@/modules/finance/types';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import type { Bean } from '@/types/domain';

import { buildFinanceExpenseTitle, financeExpenseCategoryOptions } from '../utils/expensePresentation';
import styles from './FinanceEntryForm.module.css';

const { TextArea } = Input;

interface FinanceExpenseFormProps {
  beans: Bean[];
  customCategorySuggestions?: string[];
  embedded?: boolean;
  expenseRecords: FinanceExpenseRecord[];
  isSaving: boolean;
  onCancel?: () => void;
  onSubmit: (input: FinanceExpenseFormInput) => Promise<void>;
  roastBatches: RoastBatchRecord[];
  showHeader?: boolean;
  templates: CostTemplate[];
}

interface ShippingBatchOption {
  batch: RoastBatchRecord;
  availableUnitCount: number;
}

const fieldPathMap: Record<string, FieldPath<FinanceExpenseFormInput>> = {
  amount: 'amount',
  category: 'category',
  customCategoryLabel: 'customCategoryLabel',
  expenseDate: 'expenseDate',
  notes: 'notes',
  roastBatchIds: 'roastBatchIds',
  status: 'status',
  title: 'title',
};

const defaultValues: FinanceExpenseFormInput = {
  amount: 0,
  category: 'packaging',
  customCategoryLabel: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  notes: '',
  roastBatchIds: [],
  status: 'paid',
  title: buildFinanceExpenseTitle('packaging'),
};

const getErrorMessage = (error: { message?: string } | undefined): string | undefined => {
  return typeof error?.message === 'string' ? error.message : undefined;
};

const getHelpText = (message: string | undefined, fallback: string): string => {
  return message ?? fallback;
};

const joinClassNames = (...classNames: (false | null | string | undefined)[]): string => {
  return classNames.filter((className): className is string => Boolean(className)).join(' ');
};

const getBatchCountById = (batchIds: string[]): Map<string, number> => {
  return batchIds.reduce((counts, batchId) => {
    counts.set(batchId, (counts.get(batchId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
};

const repeatBatchId = (batchId: string, count: number): string[] => {
  return Array.from({ length: count }, () => batchId);
};

const getRoastBatchDisplayName = (batch: RoastBatchRecord): string => {
  const roastedBeanName = batch.roastedBeanName?.trim();

  return roastedBeanName && roastedBeanName.length > 0 ? roastedBeanName : batch.greenBeanName;
};

export function FinanceExpenseForm({
  beans,
  customCategorySuggestions,
  embedded = false,
  expenseRecords,
  isSaving,
  onCancel,
  onSubmit,
  roastBatches,
  showHeader = true,
  templates,
}: FinanceExpenseFormProps) {
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setError,
  } = useForm<FinanceExpenseFormInput>({
    defaultValues,
  });
  const selectedCategory = useWatch({ control, name: 'category' });
  const shippingBatchOptions = useMemo<ShippingBatchOption[]>(() => {
    const beansById = new Map(beans.map((bean) => [String(bean.id), bean]));
    const templatesById = buildCostTemplateById(templates);
    const reservedUnitCountByBatchId = buildReservedShippingUnitCountByBatchId(expenseRecords);

    return roastBatches.flatMap((batch) => {
      if (batch.salesMode !== 'sale' || batch.status !== 'completed') {
        return [];
      }

      const bean = beansById.get(batch.greenBeanId);
      const template = bean ? resolveBeanCostTemplate(bean, templatesById) : null;

      if (!template) {
        return [];
      }

      const maximumUnitCount = calculateRoastSaleCapacity(batch.inputWeightGrams, template).maximumSoldUnitCount;
      const availableUnitCount = maximumUnitCount - (reservedUnitCountByBatchId.get(batch.id) ?? 0);

      return availableUnitCount > 0 ? [{ batch, availableUnitCount }] : [];
    });
  }, [beans, expenseRecords, roastBatches, templates]);

  const submitForm = async (values: FinanceExpenseFormInput) => {
    clearErrors();
    const nextValues: FinanceExpenseFormInput = {
      ...values,
      title: buildFinanceExpenseTitle(values.category, values.customCategoryLabel),
    };
    const parsed = financeExpenseFormSchema.safeParse(nextValues);

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

    try {
      await onSubmit({
        ...parsed.data,
        notes: parsed.data.notes ?? '',
      });
      reset(defaultValues);
    } catch {
      return;
    }
  };

  return (
    <form
      className={joinClassNames(styles.panel, embedded && styles.panelEmbedded)}
      onSubmit={(event) => void handleSubmit(submitForm)(event)}
    >
      {showHeader ? (
        <header className={styles.header}>
          <h2>新增支出</h2>
          <p>这里记录包装、邮费和其他实际支出；生豆采购会根据生豆录入的采购日期与购买总价自动计入。</p>
        </header>
      ) : (
        <p className={styles.embeddedDescription}>
          这里记录包装、邮费和其他实际支出；生豆采购会根据生豆录入的采购日期与购买总价自动计入。
        </p>
      )}

      <div className={styles.groupStack}>
        <section className={styles.groupPanel}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>支出日期</span>
              <Controller
                control={control}
                name="expenseDate"
                render={({ field }) => (
                  <AdaptiveDateTimeField
                    ariaLabel="支出日期"
                    mode="date"
                    placeholder="选择支出日期"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <span className={joinClassNames(styles.helpText, errors.expenseDate && styles.errorText)}>
                {getHelpText(getErrorMessage(errors.expenseDate), '用于当前统计范围内的支出汇总')}
              </span>
            </label>

            <label className={styles.field}>
              <span>类别</span>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    aria-label="支出类别"
                    options={financeExpenseCategoryOptions}
                    showSearch={false}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <span className={joinClassNames(styles.helpText, errors.category && styles.errorText)}>
                {getHelpText(getErrorMessage(errors.category), '包装和邮费是默认类别，也可以新增其他支出类型')}
              </span>
            </label>

            {selectedCategory === 'custom' ? (
              <label className={joinClassNames(styles.field, styles.fieldWide)}>
                <span>自定义类别</span>
                <Controller
                  control={control}
                  name="customCategoryLabel"
                  render={({ field }) => (
                    <Input
                      aria-label="自定义类别"
                      placeholder="例如 耗材 / 平台服务费"
                      value={field.value ?? ''}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                      }}
                    />
                  )}
                />
                <span className={joinClassNames(styles.helpText, errors.customCategoryLabel && styles.errorText)}>
                  {getHelpText(
                    getErrorMessage(errors.customCategoryLabel),
                    customCategorySuggestions && customCategorySuggestions.length > 0
                      ? `历史类别可直接手动输入，例如 ${customCategorySuggestions.slice(0, 2).join(' / ')}`
                      : '保存后会在下次新增支出时继续复用',
                  )}
                </span>
              </label>
            ) : null}

            {selectedCategory === 'shipping' ? (
              <label className={joinClassNames(styles.field, styles.fieldWide)}>
                <span>关联烘焙记录</span>
                <Controller
                  control={control}
                  name="roastBatchIds"
                  render={({ field }) => {
                    const selectedBatchIds = field.value ?? [];
                    const batchCountById = getBatchCountById(selectedBatchIds);
                    const selectedUniqueBatchIds = Array.from(batchCountById.keys());
                    const selectedOptions = shippingBatchOptions.filter(({ batch }) => batchCountById.has(batch.id));

                    return (
                      <div className={styles.shippingControl}>
                        <AntdSelect
                          aria-label="关联烘焙记录"
                          className={styles.shippingSelect}
                          maxTagCount={0}
                          maxTagPlaceholder={() => `已关联 ${String(selectedUniqueBatchIds.length)} 条记录，共 ${String(selectedBatchIds.length)} 份`}
                          mode="multiple"
                          optionFilterProp="label"
                          popupMatchSelectWidth
                          options={shippingBatchOptions.map(({ batch, availableUnitCount }) => ({
                            label: `${getRoastBatchDisplayName(batch)} · ${batch.roastDate.slice(0, 10)} · 可关联 ${String(availableUnitCount)} 份`,
                            value: batch.id,
                          }))}
                          placeholder="选择销售烘焙记录"
                          value={selectedUniqueBatchIds}
                          onChange={(nextBatchIds: string[]) => {
                            const nextValue = nextBatchIds.flatMap((batchId) => {
                              return repeatBatchId(batchId, batchCountById.get(batchId) ?? 1);
                            });
                            field.onChange(nextValue);
                          }}
                        />

                        {selectedOptions.length > 0 ? (
                          <div className={styles.shippingAllocationList}>
                            {selectedOptions.map(({ batch, availableUnitCount }) => {
                              const batchName = getRoastBatchDisplayName(batch);
                              const count = batchCountById.get(batch.id) ?? 1;

                              return (
                                <div className={styles.shippingAllocationRow} key={batch.id}>
                                  <span className={styles.shippingBatchName} title={`${batchName} · ${batch.roastDate.slice(0, 10)}`}>
                                    {batchName} · {batch.roastDate.slice(0, 10)}
                                  </span>
                                  <InputNumber
                                    aria-label={`${batchName} 关联份数`}
                                    max={availableUnitCount}
                                    min={1}
                                    precision={0}
                                    suffix="份"
                                    value={Math.min(count, availableUnitCount)}
                                    onChange={(nextCount) => {
                                      const normalizedCount = Math.max(1, Math.min(availableUnitCount, nextCount ?? 1));
                                      const nextValue = selectedUniqueBatchIds.flatMap((batchId) => {
                                        return repeatBatchId(
                                          batchId,
                                          batchId === batch.id ? normalizedCount : batchCountById.get(batchId) ?? 1,
                                        );
                                      });
                                      field.onChange(nextValue);
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  }}
                />
                <span className={joinClassNames(styles.helpText, errors.roastBatchIds && styles.errorText)}>
                  {getHelpText(getErrorMessage(errors.roastBatchIds), '可关联份数会扣除其他邮费支出已关联的份数；邮费按全部关联份数平均分摊')}
                </span>
              </label>
            ) : null}

            <label className={styles.field}>
              <span>金额</span>
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <InputNumber
                    aria-label="支出金额"
                    min={0.01}
                    precision={2}
                    prefix="¥"
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value ?? 0);
                    }}
                  />
                )}
              />
              <span className={joinClassNames(styles.helpText, errors.amount && styles.errorText)}>
                {getHelpText(getErrorMessage(errors.amount), '只记录本次实际支出金额')}
              </span>
            </label>

            <label className={styles.field}>
              <span>状态</span>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    aria-label="支出状态"
                    options={[
                      { label: '已支付', value: 'paid' },
                      { label: '待支付', value: 'pending' },
                    ]}
                    showSearch={false}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <span className={styles.helpText}>已支付才会计入全部花费</span>
            </label>
          </div>
        </section>

        <section className={styles.groupPanel}>
          <div className={styles.grid}>
            <label className={joinClassNames(styles.field, styles.fieldWide)}>
              <span>备注</span>
              <Controller
                control={control}
                name="notes"
                render={({ field }) => (
                  <TextArea
                    {...field}
                    aria-label="支出备注"
                    autoSize={{ maxRows: 4, minRows: 3 }}
                    placeholder="例如 供应商、用途、账单周期等"
                    value={field.value ?? ''}
                  />
                )}
              />
              {errors.notes ? (
                <span className={joinClassNames(styles.helpText, styles.errorText)}>
                  {getErrorMessage(errors.notes)}
                </span>
              ) : null}
            </label>
          </div>
        </section>
      </div>

      <DrawerActionBar compact>
        {onCancel ? <Button block onClick={onCancel}>取消</Button> : null}
        <Button aria-label="保存支出记录" block htmlType="submit" icon={<SaveOutlined />} loading={isSaving} type="primary">
          保存支出记录
        </Button>
      </DrawerActionBar>
    </form>
  );
}
