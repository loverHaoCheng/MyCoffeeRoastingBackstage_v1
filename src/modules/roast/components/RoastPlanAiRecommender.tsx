import App from 'antd/es/app';
import Button from 'antd/es/button';
import { Controller, useForm } from 'react-hook-form';

import { useBeans } from '@/modules/bean/hooks';
import { useRoastAiUsage, useRoastPlanRecommendation, useRoastingMachines } from '@/modules/roast/hooks';
import type { RoastPlanJsonInput, RoastPlanRecommendationInput } from '@/modules/roast/types';
import { formatRoastAiUsageText, isRoastAiUsageAvailable } from '@/modules/roast/services/roastAiUsage.service';
import { Select } from '@/components/ui/select';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './RoastPlanManualCreator.module.css';

const { TextArea } = Input;
const GENERIC_BEAN_ID = 'generic';

interface RoastPlanAiRecommenderProps {
  onCancel?: () => void;
  onRecommended: (input: RoastPlanJsonInput) => void;
}

const defaultValues: RoastPlanRecommendationInput = {
  batchWeightGrams: 200,
  beanId: '',
  flavorExpectation: '',
  planName: 'AI 推荐烘焙计划',
  purpose: '手冲',
  roastLevel: '浅度烘焙',
  roasterMachineId: '',
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

export function RoastPlanAiRecommender({ onCancel, onRecommended }: RoastPlanAiRecommenderProps) {
  const { message } = App.useApp();
  const { data: beans = [], isLoading: beansLoading } = useBeans();
  const { data: roastingMachines = [], isLoading: roastingMachinesLoading } = useRoastingMachines();
  const usageQuery = useRoastAiUsage('roast_plan_recommendation');
  const recommendationMutation = useRoastPlanRecommendation();
  const beanOptions = [
    { label: '通用', value: GENERIC_BEAN_ID },
    ...beans.map((bean) => ({
      label: bean.name,
      value: String(bean.id),
    })),
  ];
  const roastingMachineOptions = roastingMachines.map((machine) => ({
    label: `${machine.displayName} · ${machine.modelKey}`,
    value: machine.id,
  }));
  const { control, handleSubmit, setFocus } = useForm<RoastPlanRecommendationInput>({
    defaultValues: {
      ...defaultValues,
      beanId: beans[0] ? String(beans[0].id) : GENERIC_BEAN_ID,
      roasterMachineId: roastingMachines[0]?.id ?? '',
    },
    values: {
      ...defaultValues,
      beanId: beans[0] ? String(beans[0].id) : GENERIC_BEAN_ID,
      roasterMachineId: roastingMachines[0]?.id ?? '',
    },
  });
  const usageErrorText = usageQuery.error instanceof Error ? usageQuery.error.message : '';
  const usageText = formatRoastAiUsageText(usageQuery.data, {
    error: usageErrorText,
    isLoading: usageQuery.isLoading,
  });
  const canUseQuota = isRoastAiUsageAvailable(usageQuery.data);

  const submitForm = async (values: RoastPlanRecommendationInput) => {
    if (!values.beanId) {
      void message.warning('请选择生豆或“通用”。');
      setFocus('beanId');
      return;
    }

    if (!canUseQuota) {
      void message.warning('本月 AI 推荐烘焙计划额度不足或暂不可用。');
      return;
    }

    if (!values.planName.trim()) {
      void message.warning('请填写计划名称。');
      setFocus('planName');
      return;
    }

    if (!values.roasterMachineId) {
      void message.warning('请选择已关联烘焙机。');
      setFocus('roasterMachineId');
      return;
    }

    if (!values.roastLevel.trim()) {
      void message.warning('请填写预期烘焙度。');
      setFocus('roastLevel');
      return;
    }

    if (!values.flavorExpectation.trim()) {
      void message.warning('请填写期望风味感受。');
      setFocus('flavorExpectation');
      return;
    }

    try {
      const recommendation = await recommendationMutation.mutateAsync(values);

      onRecommended(recommendation.modifiedPlanJson);
      void message.success('AI 已生成烘焙计划草稿，请确认后创建。');
    } catch (error: unknown) {
      void message.error(getUserFacingErrorMessage(error, 'AI 推荐生成失败，请稍后重试。'));
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(submitForm)(event)}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>AI 推荐条件</h3>
          <p>结合机器历史理解、生豆特征和目标风味，生成一份可编辑的起始烘焙计划草稿。</p>
        </div>

        <div className={styles.fieldGrid}>
          <label className={styles.field} data-field-path="planName">
            {renderLabel('计划名称', true)}
            <Controller
              control={control}
              name="planName"
              render={({ field }) => <Input {...field} placeholder="例如 埃塞水洗浅烘 AI 推荐计划" />}
            />
          </label>

          <label className={styles.field} data-field-path="beanId">
            {renderLabel('生豆', true)}
            <Controller
              control={control}
              name="beanId"
              render={({ field }) => (
                <Select
                  aria-label="AI 推荐生豆"
                  loading={beansLoading}
                  onChange={field.onChange}
                  options={beanOptions}
                  placeholder="选择生豆或通用计划"
                  showSearch={false}
                  value={field.value || undefined}
                />
              )}
            />
          </label>

          <label className={styles.field} data-field-path="roasterMachineId">
            {renderLabel('已关联烘焙机', true)}
            <Controller
              control={control}
              name="roasterMachineId"
              render={({ field }) => (
                <Select
                  aria-label="AI 推荐烘豆机"
                  disabled={!roastingMachinesLoading && roastingMachineOptions.length === 0}
                  loading={roastingMachinesLoading}
                  onChange={field.onChange}
                  options={roastingMachineOptions}
                  placeholder={roastingMachineOptions.length === 0 ? '请先在设置中关联烘焙机' : '选择已关联烘焙机'}
                  showSearch={false}
                  value={field.value || undefined}
                />
              )}
            />
          </label>

          <label className={styles.field} data-field-path="batchWeightGrams">
            {renderLabel('批次重量', true)}
            <Controller
              control={control}
              name="batchWeightGrams"
              render={({ field }) => (
                <InputNumber
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
          </label>

          <label className={styles.field} data-field-path="roastLevel">
            {renderLabel('预期烘焙度', true)}
            <Controller
              control={control}
              name="roastLevel"
              render={({ field }) => <Input {...field} placeholder="例如 手冲浅烘 / 浅中烘 / 意式中深烘" />}
            />
          </label>

          <label className={styles.field} data-field-path="purpose">
            {renderLabel('用途')}
            <Controller
              control={control}
              name="purpose"
              render={({ field }) => <Input {...field} placeholder="例如 手冲、意式、样品测试" value={field.value ?? ''} />}
            />
          </label>

          <label className={[styles.field, styles.fullField].filter(Boolean).join(' ')} data-field-path="flavorExpectation">
            {renderLabel('期望风味感受', true)}
            <Controller
              control={control}
              name="flavorExpectation"
              render={({ field }) => (
                <TextArea
                  {...field}
                  autoSize={{ maxRows: 8, minRows: 4 }}
                  placeholder="例如 希望提高花香和柑橘酸质，降低尖酸，保留干净甜感。"
                />
              )}
            />
          </label>
        </div>
      </section>

      <p className={styles.actionHint}>{usageText}</p>

      <DrawerActionBar compact>
        {onCancel ? (
          <Button onClick={onCancel} type="default">
            取消
          </Button>
        ) : null}
        <Button
          disabled={roastingMachineOptions.length === 0 || !canUseQuota}
          htmlType="submit"
          loading={recommendationMutation.isPending || usageQuery.isLoading}
          type="primary"
        >
          生成 AI 推荐计划
        </Button>
      </DrawerActionBar>
    </form>
  );
}
