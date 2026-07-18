import SaveOutlined from '@ant-design/icons/SaveOutlined';
import Button from "antd/es/button";
import { Select } from '@/components/ui/select';
import { AdaptiveDateTimeField } from '@/shared/components/AdaptiveDateTimeField';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';
import { Controller, type FieldPath, useForm } from 'react-hook-form';

import { financeIncomeFormSchema } from '@/modules/finance/schemas';
import type { FinanceIncomeFormInput } from '@/modules/finance/types';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';

import { buildFinanceIncomeTitle, financeIncomeChannelOptions } from '../utils/incomePresentation';
import styles from './FinanceEntryForm.module.css';

const { TextArea } = Input;

interface FinanceIncomeFormProps {
  embedded?: boolean;
  isSaving: boolean;
  onCancel?: () => void;
  onSubmit: (input: FinanceIncomeFormInput) => Promise<void>;
  showHeader?: boolean;
}

const fieldPathMap: Record<string, FieldPath<FinanceIncomeFormInput>> = {
  amount: 'amount',
  channel: 'channel',
  incomeDate: 'incomeDate',
  notes: 'notes',
  status: 'status',
  title: 'title',
};

const defaultValues: FinanceIncomeFormInput = {
  amount: 0,
  channel: 'retail',
  incomeDate: new Date().toISOString().slice(0, 10),
  notes: '',
  status: 'received',
  title: buildFinanceIncomeTitle('retail'),
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

export function FinanceIncomeForm({
  embedded = false,
  isSaving,
  onCancel,
  onSubmit,
  showHeader = true,
}: FinanceIncomeFormProps) {
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setError,
  } = useForm<FinanceIncomeFormInput>({
    defaultValues,
  });

  const submitForm = async (values: FinanceIncomeFormInput) => {
    clearErrors();
    const nextValues: FinanceIncomeFormInput = {
      ...values,
      title: buildFinanceIncomeTitle(values.channel),
    };
    const parsed = financeIncomeFormSchema.safeParse(nextValues);

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
          <h2>补录收入</h2>
          <p>这里记录烘焙历史之外的实际收入；只有已收款收入会计入已实现收入与利润。</p>
        </header>
      ) : (
        <p className={styles.embeddedDescription}>
          这里记录烘焙历史之外的实际收入；只有已收款收入会计入已实现收入与利润。
        </p>
      )}

      <div className={styles.groupStack}>
        <section className={styles.groupPanel}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>收入日期</span>
              <Controller
                control={control}
                name="incomeDate"
                render={({ field }) => (
                  <AdaptiveDateTimeField
                    ariaLabel="收入日期"
                    mode="date"
                    placeholder="选择收入日期"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <span className={joinClassNames(styles.helpText, errors.incomeDate && styles.errorText)}>
                {getHelpText(getErrorMessage(errors.incomeDate), '用于当前统计范围内的收入汇总')}
              </span>
            </label>

            <label className={styles.field}>
              <span>类别</span>
              <Controller
                control={control}
                name="channel"
                render={({ field }) => (
                  <Select
                    aria-label="收入类别"
                    options={financeIncomeChannelOptions}
                    showSearch={false}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <span className={joinClassNames(styles.helpText, errors.channel && styles.errorText)}>
                {getHelpText(getErrorMessage(errors.channel), '按收入来源选择零售、批发或其他')}
              </span>
            </label>

            <label className={styles.field}>
              <span>金额</span>
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <InputNumber
                    aria-label="收入金额"
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
                {getHelpText(getErrorMessage(errors.amount), '只记录本次实际收入金额')}
              </span>
            </label>

            <label className={styles.field}>
              <span>状态</span>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    aria-label="收入状态"
                    options={[
                      { label: '已收款', value: 'received' },
                      { label: '待收款', value: 'pending' },
                    ]}
                    showSearch={false}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <span className={styles.helpText}>已收款才会计入已实现收入</span>
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
                    aria-label="收入备注"
                    autoSize={{ maxRows: 4, minRows: 3 }}
                    placeholder="例如 客户、平台、补录原因等"
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
        <Button aria-label="保存收入记录" block htmlType="submit" icon={<SaveOutlined />} loading={isSaving} type="primary">
          保存收入记录
        </Button>
      </DrawerActionBar>
    </form>
  );
}
