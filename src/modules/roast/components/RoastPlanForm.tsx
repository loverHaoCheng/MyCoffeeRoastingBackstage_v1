import { DownOutlined, MinusCircleOutlined, PlusOutlined, SaveOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Select, Space } from 'antd';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import { useBeans } from '@/modules/bean/hooks';

import type { RoastPlanJsonInput } from '../types';

import styles from './RoastPlanManualCreator.module.css';

interface RoastPlanFormProps {
  initialValues: RoastPlanJsonInput;
  onSubmit: (input: RoastPlanJsonInput) => void;
  resetOnSubmit?: boolean;
  submitLabel: string;
}

export function RoastPlanForm({
  initialValues,
  onSubmit,
  resetOnSubmit = false,
  submitLabel,
}: RoastPlanFormProps) {
  const { data: beans = [], isLoading: beansLoading } = useBeans();
  const { control, handleSubmit, reset, setValue } = useForm<RoastPlanJsonInput>({
    defaultValues: initialValues,
  });
  const { append, fields, move, remove } = useFieldArray({
    control,
    name: 'steps',
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const submitForm = (values: RoastPlanJsonInput) => {
    const selectedBean = beans.find((bean) => bean.id === values.beanId);

    onSubmit({
      ...values,
      beanName: selectedBean?.name ?? values.beanName,
    });

    if (resetOnSubmit) {
      reset(initialValues);
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(submitForm)(event)}>
      <section className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>计划名称</span>
          <Controller
            control={control}
            name="name"
            render={({ field }) => <Input {...field} placeholder="例如 肯尼亚 柏拉 AA Plus 水洗" />}
          />
        </label>

        <label className={styles.field}>
          <span>生豆</span>
          <Controller
            control={control}
            name="beanId"
            render={({ field }) => (
              <Select
                aria-label="生豆"
                loading={beansLoading}
                onChange={(beanId) => {
                  const selectedBean = beans.find((bean) => bean.id === beanId);

                  field.onChange(beanId);
                  setValue('beanName', selectedBean?.name ?? '');
                }}
                optionFilterProp="label"
                options={beans.map((bean) => ({
                  label: bean.name,
                  value: bean.id,
                }))}
                placeholder="从生豆库存选择"
                showSearch
                value={field.value}
              />
            )}
          />
        </label>

        <Controller
          control={control}
          name="beanName"
          render={({ field }) => <input {...field} type="hidden" />}
        />

        <label className={styles.field}>
          <span>批次重量</span>
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

        <label className={styles.field}>
          <span>烘焙目标</span>
          <Controller
            control={control}
            name="roastLevel"
            render={({ field }) => <Input {...field} placeholder="例如 手冲浅烘" />}
          />
        </label>

        <label className={styles.field}>
          <span>用途</span>
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
                firePower: '',
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
                      <label className={styles.field}>
                        <span>时间</span>
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.time` as `steps.${number}.time`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>事件</span>
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.event` as `steps.${number}.event`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>操作</span>
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.operation` as `steps.${number}.operation`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>炉温</span>
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.temperature` as `steps.${number}.temperature`}
                          render={({ field: itemField }) => <Input {...itemField} />}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>火力</span>
                        <Controller
                          control={control}
                          name={`steps.${stepIndex}.firePower` as `steps.${number}.firePower`}
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

      <Space className={styles.actions} wrap>
        <Button aria-label={submitLabel} block icon={<SaveOutlined />} htmlType="submit">
          {submitLabel}
        </Button>
      </Space>
    </form>
  );
}
