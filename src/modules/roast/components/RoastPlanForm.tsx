import DownOutlined from "@ant-design/icons/DownOutlined";
import MinusCircleOutlined from "@ant-design/icons/MinusCircleOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import UpOutlined from "@ant-design/icons/UpOutlined";
import App from 'antd/es/app';
import Button from "antd/es/button";
import { Select } from '@/shared/components/ui/select';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';
import { Controller } from 'react-hook-form';

import { DrawerActionBar } from '@/shared/components/DrawerActionBar';

import type { RoastPlanJsonInput } from '../types';

import { GENERIC_BEAN_ID, GENERIC_BEAN_NAME, renderLabel } from './RoastPlanForm/formConstants';
import { stripUnit } from './RoastPlanForm/formatUtils';
import { TimeField } from './RoastPlanForm/TimeField';
import { useRoastPlanForm } from './RoastPlanForm/useRoastPlanForm';
import styles from './RoastPlanManualCreator.module.css';

interface RoastPlanFormProps {
  initialValues: RoastPlanJsonInput;
  onCancel?: () => void;
  onSubmit: (input: RoastPlanJsonInput) => Promise<void> | void;
  resetOnSubmit?: boolean;
  submitLabel: string;
}

export function RoastPlanForm({
  initialValues,
  onCancel,
  onSubmit,
  resetOnSubmit = false,
  submitLabel,
}: RoastPlanFormProps) {
  const { message } = App.useApp();
  const {
    control,
    handleSubmit,
    setValue,
    fields,
    move,
    remove,
    beans,
    beansLoading,
    beanOptions,
    roastingMachines,
    roastingMachinesLoading,
    roastingMachineOptions,
    showAirTemperature,
    showAirDamper,
    showDrumSpeed,
    showFirePower,
    submitForm,
    handleAppendStep,
  } = useRoastPlanForm(initialValues, onSubmit, resetOnSubmit, message);

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(submitForm)(event)}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>基础信息</h3>
          <p>选择生豆、烘焙机和目标，让计划可以被烘焙记录直接引用。</p>
        </div>

        <div className={styles.fieldGrid}>
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
            {renderLabel('已关联烘焙机', true)}
            <Controller
              control={control}
              name="roasterMachineId"
              render={({ field }) => (
                <Select
                  aria-label="已关联烘焙机"
                  disabled={!roastingMachinesLoading && roastingMachineOptions.length === 0}
                  loading={roastingMachinesLoading}
                  onChange={(value) => {
                    field.onChange(value);
                    setValue('roasterModel', roastingMachines.find((machine) => machine.id === value)?.displayName ?? '');
                  }}
                  options={roastingMachineOptions}
                  placeholder={roastingMachineOptions.length === 0 ? '请先在设置中关联烘焙机' : '选择已关联的烘焙机'}
                  showSearch={false}
                  value={field.value ?? undefined}
                />
              )}
            />
          </label>

          <Controller
            control={control}
            name="roasterModel"
            render={({ field }) => <input {...field} type="hidden" />}
          />

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
        </div>
      </section>

      <section className={[styles.section, styles.steps].filter(Boolean).join(' ')}>
        <div className={styles.stepsHeader}>
          <div className={styles.sectionHeader}>
            <h3>烘焙节点</h3>
            <p>
              {showAirTemperature || showDrumSpeed
                ? '按时间记录每一步火力、风温、转速和操作，便于复盘与复制。'
                : '按时间记录每一步炉温、火力和操作，便于复盘与复制。'}
            </p>
          </div>
          <Button
            aria-label="添加节点"
            icon={<PlusOutlined />}
            onClick={handleAppendStep}
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
                          render={({ field: itemField }) => <TimeField name={itemField.name} value={itemField.value} onChange={itemField.onChange} />}
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
                          render={({ field: itemField }) => <Input {...itemField} suffix="℃" value={stripUnit(itemField.value)} />}
                        />
                      </label>
                      {showFirePower ? (
                        <label className={styles.field} data-field-path={`steps.${stepIndex}.firePower`}>
                          {renderLabel('火力', true)}
                          <Controller
                            control={control}
                            name={`steps.${stepIndex}.firePower` as `steps.${number}.firePower`}
                            render={({ field: itemField }) => <Input {...itemField} suffix="%" />}
                          />
                        </label>
                      ) : null}
                      {showAirTemperature ? (
                        <label className={styles.field} data-field-path={`steps.${stepIndex}.airTemperature`}>
                          {renderLabel('风温', true)}
                          <Controller
                            control={control}
                            name={`steps.${stepIndex}.airTemperature` as `steps.${number}.airTemperature`}
                            render={({ field: itemField }) => <Input {...itemField} suffix="℃" value={stripUnit(itemField.value)} />}
                          />
                        </label>
                      ) : null}
                      {showDrumSpeed ? (
                        <label className={styles.field} data-field-path={`steps.${stepIndex}.drumSpeed`}>
                          {renderLabel('转速', true)}
                          <Controller
                            control={control}
                            name={`steps.${stepIndex}.drumSpeed` as `steps.${number}.drumSpeed`}
                            render={({ field: itemField }) => <Input {...itemField} suffix="r" value={stripUnit(itemField.value)} />}
                          />
                        </label>
                      ) : null}
                      {showAirDamper ? (
                        <label className={styles.field} data-field-path={`steps.${stepIndex}.airDamper`}>
                          {renderLabel('风门', true)}
                          <Controller control={control} name={`steps.${stepIndex}.airDamper` as `steps.${number}.airDamper`} render={({ field: itemField }) => <Input {...itemField} suffix="%" />} />
                        </label>
                      ) : null}
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
