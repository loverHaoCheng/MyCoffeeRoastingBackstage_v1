import DownOutlined from "@ant-design/icons/DownOutlined";
import MinusCircleOutlined from "@ant-design/icons/MinusCircleOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import UpOutlined from "@ant-design/icons/UpOutlined";
import { App } from 'antd';
import Button from "antd/es/button";
import Input from "antd/es/input";
import InputNumber from "antd/es/input-number";
import Select from "antd/es/select";
import { useEffect } from 'react';
import { Controller, type FieldPath, useFieldArray, useForm } from 'react-hook-form';

import { useBeans } from '@/modules/bean/hooks';
import { roasterModelSelectOptions } from '@/modules/roast/constants/roasterModel';
import { roastPlanJsonSchema } from '@/modules/roast/schemas/roastPlanJson.schema';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';

import type { RoastPlanJsonInput } from '../types';

import styles from './RoastPlanManualCreator.module.css';

const GENERIC_BEAN_ID = 'generic';
const GENERIC_BEAN_NAME = '通用';

interface RoastPlanFormProps {
  initialValues: RoastPlanJsonInput;
  onCancel?: () => void;
  onSubmit: (input: RoastPlanJsonInput) => Promise<void> | void;
  resetOnSubmit?: boolean;
  submitLabel: string;
}

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

export function RoastPlanForm({
  initialValues,
  onCancel,
  onSubmit,
  resetOnSubmit = false,
  submitLabel,
}: RoastPlanFormProps) {
  const { message } = App.useApp();
  const { data: beans = [], isLoading: beansLoading } = useBeans();
  const beanOptions = [
    { label: GENERIC_BEAN_NAME, value: GENERIC_BEAN_ID },
    ...beans.map((bean) => ({
      label: bean.name,
      value: String(bean.id),
    })),
  ];
  const { control, handleSubmit, reset, setFocus, setValue } = useForm<RoastPlanJsonInput>({
    defaultValues: initialValues,
  });
  const { append, fields, move, remove } = useFieldArray({
    control,
    name: 'steps',
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const submitForm = async (values: RoastPlanJsonInput) => {
    if (values.beanId == null || String(values.beanId).trim().length === 0) {
      void message.warning('请选择生豆或“通用”后再保存烘焙计划。');
      window.requestAnimationFrame(() => {
        setFocus('beanId');
      });
      return;
    }

    const selectedBean = beans.find((bean) => String(bean.id) === String(values.beanId));
    const isGenericPlan = String(values.beanId) === GENERIC_BEAN_ID;
    const payload = {
      ...values,
      beanName: isGenericPlan ? GENERIC_BEAN_NAME : selectedBean?.name ?? values.beanName,
    };
    const validationResult = roastPlanJsonSchema.safeParse(payload);

    if (!validationResult.success) {
      void message.error(validationResult.error.issues.map((issue) => issue.message).join('；'));
      const firstFieldPath = validationResult.error.issues
        .map((issue) => issue.path.join('.') as FieldPath<RoastPlanJsonInput>)
        .find(Boolean);

      if (firstFieldPath) {
        window.requestAnimationFrame(() => {
          setFocus(firstFieldPath);
        });
      }
      return;
    }

    await onSubmit(validationResult.data);

    if (resetOnSubmit) {
      reset(initialValues);
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(submitForm)(event)}>
      <section className={styles.fieldGrid}>
        <label className={styles.field} data-field-path="name">
          {renderLabel('计划名称', true)}
          <Controller
            control={control}
            name="name"
            render={({ field }) => <Input {...field} placeholder="例如 肯尼亚 柏拉 AA Plus 水洗" />}
          />
        </label>

        <label className={styles.field} data-field-path="beanId">
          {renderLabel('生豆', true)}
          <Controller
            control={control}
            name="beanId"
            render={({ field }) => (
              <Select
                aria-label="生豆"
                loading={beansLoading}
                onChange={(beanId) => {
                  const selectedBean = beans.find((bean) => String(bean.id) === beanId);

                  field.onChange(beanId);
                  setValue('beanName', beanId === GENERIC_BEAN_ID ? GENERIC_BEAN_NAME : selectedBean?.name ?? '');
                }}
                options={beanOptions}
                placeholder="从生豆库存选择，或使用通用计划"
                showSearch={false}
                value={field.value == null ? undefined : String(field.value)}
              />
            )}
          />
        </label>

        <Controller
          control={control}
          name="beanName"
          render={({ field }) => <input {...field} type="hidden" />}
        />

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

        <label className={styles.field} data-field-path="roasterModel">
          {renderLabel('烘豆机型号', true)}
          <Controller
            control={control}
            name="roasterModel"
            render={({ field }) => (
              <Select
                aria-label="烘豆机型号"
                onChange={(value) => {
                  field.onChange(value);
                }}
                options={roasterModelSelectOptions}
                placeholder="请选择烘豆机型号"
                showSearch={false}
                value={field.value || undefined}
              />
            )}
          />
        </label>

        <label className={styles.field} data-field-path="roastLevel">
          {renderLabel('烘焙目标', true)}
          <Controller
            control={control}
            name="roastLevel"
            render={({ field }) => <Input {...field} placeholder="例如 手冲浅烘" />}
          />
        </label>

        <label className={styles.field} data-field-path="purpose">
          {renderLabel('用途')}
          <Controller
            control={control}
            name="purpose"
            render={({ field }) => <Input {...field} placeholder="例如 手冲" />}
          />
        </label>
      </section>

      <section className={styles.steps}>
        <div className={styles.stepsHeader}>
          <h3>烘焙节点</h3>
          <Button
            aria-label="添加节点"
            icon={<PlusOutlined />}
            onClick={() => {
              append({
                time: '',
                event: '',
                operation: '',
                temperature: '-',
                airTemperature: '-',
                firePower: '',
                drumSpeed: '',
              });
            }}
          >
            添加节点
          </Button>
        </div>

        <div className={styles.stepList}>
          {fields.map((field, index) => (
            <article className={styles.stepCard} key={field.id}>
              {(() => {
                const stepIndex = String(index);
                const stepNumber = String(index + 1);

                return (
                  <>
                    <div className={styles.stepCardHeader}>
                      <strong>节点 {stepNumber}</strong>
                      <div className={styles.stepActions}>
                        <Button
                          aria-label={`上移节点 ${stepNumber}`}
                          disabled={index === 0}
                          icon={<UpOutlined />}
                          onClick={() => {
                            move(index, index - 1);
                          }}
                          shape="circle"
                          type="text"
                        />
                        <Button
                          aria-label={`下移节点 ${stepNumber}`}
                          disabled={index === fields.length - 1}
                          icon={<DownOutlined />}
                          onClick={() => {
                            move(index, index + 1);
                          }}
                          shape="circle"
                          type="text"
                        />
                        <Button
                          aria-label={`删除节点 ${stepNumber}`}
                          disabled={fields.length === 1}
                          icon={<MinusCircleOutlined />}
                          onClick={() => {
                            remove(index);
                          }}
                          shape="circle"
                          type="text"
                        />
                      </div>
                    </div>

                    <div className={styles.stepFields}>
                      <label className={styles.field} data-field-path={`steps.${stepIndex}.time`}>
                        {renderLabel('时间', true)}
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.time` as `steps.${number}.time`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                      <label className={styles.field} data-field-path={`steps.${stepIndex}.event`}>
                        {renderLabel('事件', true)}
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.event` as `steps.${number}.event`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                      <label className={styles.field} data-field-path={`steps.${stepIndex}.operation`}>
                        {renderLabel('操作', true)}
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.operation` as `steps.${number}.operation`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                      <label className={styles.field} data-field-path={`steps.${stepIndex}.temperature`}>
                        {renderLabel('炉温', true)}
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.temperature` as `steps.${number}.temperature`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                      <label className={styles.field} data-field-path={`steps.${stepIndex}.firePower`}>
                        {renderLabel('火力', true)}
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.firePower` as `steps.${number}.firePower`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                      <label className={styles.field} data-field-path={`steps.${stepIndex}.airTemperature`}>
                        {renderLabel('风温', true)}
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.airTemperature` as `steps.${number}.airTemperature`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                      <label className={styles.field} data-field-path={`steps.${stepIndex}.drumSpeed`}>
                        {renderLabel('转速', true)}
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.drumSpeed` as `steps.${number}.drumSpeed`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                    </div>
                  </>
                );
              })()}
            </article>
          ))}
        </div>
      </section>

      <DrawerActionBar compact>
        {onCancel ? <Button onClick={onCancel}>取消</Button> : null}
        <Button aria-label={submitLabel} block icon={<SaveOutlined />} htmlType="submit" type="primary">
          {submitLabel}
        </Button>
      </DrawerActionBar>
    </form>
  );
}
