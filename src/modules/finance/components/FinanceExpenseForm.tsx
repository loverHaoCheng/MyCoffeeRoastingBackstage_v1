import { AutoComplete, Button, DatePicker, Input, InputNumber, Select } from 'antd';
import dayjs from 'dayjs';
import { Controller, type FieldPath, useForm, useWatch } from 'react-hook-form';

import { financeExpenseFormSchema } from '@/modules/finance/schemas';
import type { FinanceExpenseFormInput } from '@/modules/finance/types';

import { buildFinanceExpenseTitle, financeExpenseCategoryOptions } from '../utils/expensePresentation';
import styles from './FinanceEntryForm.module.css';

const { TextArea } = Input;

interface FinanceExpenseFormProps {
  customCategorySuggestions?: string[];
  embedded?: boolean;
  isSaving: boolean;
  onSubmit: (input: FinanceExpenseFormInput) => Promise<void>;
  showHeader?: boolean;
}

const fieldPathMap: Record<string, FieldPath<FinanceExpenseFormInput>> = {
  amount: 'amount',
  category: 'category',
  customCategoryLabel: 'customCategoryLabel',
  expenseDate: 'expenseDate',
  notes: 'notes',
  status: 'status',
  title: 'title',
};

const defaultValues: FinanceExpenseFormInput = {
  amount: 0,
  category: 'packaging',
  customCategoryLabel: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  notes: '',
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

const toPickerValue = (value: string) => {
  const parsed = dayjs(value, 'YYYY-MM-DD', true);

  return parsed.isValid() ? parsed : null;
};

export function FinanceExpenseForm({
  customCategorySuggestions,
  embedded = false,
  isSaving,
  onSubmit,
  showHeader = true,
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

    await onSubmit({
      ...parsed.data,
      notes: parsed.data.notes ?? '',
    });
    reset(defaultValues);
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
                  <DatePicker
                    allowClear={false}
                    aria-label="支出日期"
                    format="YYYY-MM-DD"
                    inputReadOnly
                    style={{ width: '100%' }}
                    value={toPickerValue(field.value)}
                    onChange={(date) => {
                      field.onChange(date.format('YYYY-MM-DD'));
                    }}
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
                    <AutoComplete
                      aria-label="自定义类别"
                      options={(customCategorySuggestions ?? []).map((label) => ({
                        label,
                        value: label,
                      }))}
                      placeholder="例如 耗材 / 平台服务费"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                />
                <span className={joinClassNames(styles.helpText, errors.customCategoryLabel && styles.errorText)}>
                  {getHelpText(getErrorMessage(errors.customCategoryLabel), '保存后会在下次新增支出时继续复用')}
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

      <div className={styles.actions}>
        <Button htmlType="submit" loading={isSaving} type="primary">
          保存支出记录
        </Button>
      </div>
    </form>
  );
}
