import SaveOutlined from '@ant-design/icons/SaveOutlined';
import Button from "antd/es/button";
import { Select } from '@/shared/components/ui/select';
import { AdaptiveDateTimeField } from '@/shared/components/AdaptiveDateTimeField';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';
import { Controller, type FieldPath, useForm, useWatch } from 'react-hook-form';

import { financeExpenseFormSchema } from '@/modules/finance/schemas';
import type { FinanceExpenseFormInput, FinanceExpenseRecord } from '@/modules/finance/types';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { CostTemplate } from '@/modules/settings/types';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import type { Bean } from '@/types/domain';

import { buildFinanceExpenseTitle, financeExpenseCategoryOptions } from '../utils/expensePresentation';
import { getErrorMessage, getHelpText } from './FinanceExpenseForm/formUtils';
import { useShippingBatchOptions } from './FinanceExpenseForm/useShippingBatchOptions';
import { ShippingBatchSelector } from './FinanceExpenseForm/ShippingBatchSelector';
import { FormField } from '@/shared/components/FormField';
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
  const shippingBatchOptions = useShippingBatchOptions(beans, roastBatches, expenseRecords, templates);

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
    <form className={embedded ? styles.panelEmbedded : styles.panel} onSubmit={(event) => void handleSubmit(submitForm)(event)}>
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
            <FormField
              error={getErrorMessage(errors.expenseDate)}
              helpText="用于当前统计范围内的支出汇总"
              label="支出日期"
            >
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
            </FormField>

            <FormField
              error={getErrorMessage(errors.category)}
              helpText="包装和邮费是默认类别，也可以新增其他支出类型"
              label="类别"
            >
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
            </FormField>

            {selectedCategory === 'custom' ? (
              <FormField
                error={getErrorMessage(errors.customCategoryLabel)}
                helpText={
                  customCategorySuggestions && customCategorySuggestions.length > 0
                    ? `历史类别可直接手动输入，例如 ${customCategorySuggestions.slice(0, 2).join(' / ')}`
                    : '保存后会在下次新增支出时继续复用'
                }
                label="自定义类别"
                wide
              >
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
              </FormField>
            ) : null}

            {selectedCategory === 'shipping' ? (
              <FormField
                error={getErrorMessage(errors.roastBatchIds)}
                helpText="可关联份数会扣除其他邮费支出已关联的份数；邮费按全部关联份数平均分摊"
                label="关联烘焙记录"
                wide
              >
                <ShippingBatchSelector control={control} shippingBatchOptions={shippingBatchOptions} />
              </FormField>
            ) : null}

            <FormField
              error={getErrorMessage(errors.amount)}
              helpText="只记录本次实际支出金额"
              label="金额"
            >
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
            </FormField>

            <FormField helpText="已支付才会计入全部花费" label="状态">
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
            </FormField>
          </div>
        </section>

        <section className={styles.groupPanel}>
          <div className={styles.grid}>
            <FormField error={getErrorMessage(errors.notes)} label="备注" wide>
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
            </FormField>
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
