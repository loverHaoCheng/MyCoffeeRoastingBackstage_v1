import { CoffeeOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, InputNumber, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { useRoastPlans } from '@/modules/roast/hooks';
import type { RoastBatchCreateInput } from '@/modules/roast/types/roastBatch';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { scrollToField } from '@/shared/forms/scrollToField';

import styles from './RoastBatchCreator.module.css';

const ROAST_LEVELS = ['极浅', '浅焙', '肉桂', '中浅', '中焙', '中深', '深焙', '极深'];
const ROAST_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm';
const GENERIC_BEAN_ID = 'generic';

const toPickerValue = (value: string) => {
  if (!value) {
    return null;
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed : null;
};

interface RoastBatchCreatorProps {
  onCancel?: () => void;
  onCreate: (input: RoastBatchCreateInput) => void;
}

export function RoastBatchCreator({ onCancel, onCreate }: RoastBatchCreatorProps) {
  const { data: beans = [] } = useBeans();
  const { data: plans = [] } = useRoastPlans();
  const hasBeanOptions = beans.length > 0;

  // 表单状态
  const [form, setForm] = useState({
    roastDate: dayjs().second(0).millisecond(0).toISOString(),
    greenBeanId: '',
    greenBeanName: '',
    roastedBeanName: '',
    roastPlanId: '',
    roastPlanName: '',
    inputWeightGrams: 200,
    outputWeightGrams: 180,
    roastLevel: '中焙',
    developmentRatio: undefined as number | undefined,
    firstCrackTime: undefined as number | undefined,
    totalRoastTime: undefined as number | undefined,
    notes: '',
  });
  const availablePlans = form.greenBeanId
    ? plans.filter((plan) => {
        const planBeanId = String(plan.beanId);

        return planBeanId === GENERIC_BEAN_ID || planBeanId === form.greenBeanId;
      })
    : [];

  const lossRate = form.inputWeightGrams > 0
    ? (((form.inputWeightGrams - form.outputWeightGrams) / form.inputWeightGrams) * 100).toFixed(1)
    : '-';

  const handleSubmit = () => {
    if (!form.roastDate) {
      scrollToField('roastDate');
      return;
    }

    if (!hasBeanOptions || !form.greenBeanId) {
      scrollToField('greenBeanId');
      return;
    }

    if (form.inputWeightGrams <= 0) {
      scrollToField('inputWeightGrams');
      return;
    }

    if (form.outputWeightGrams < 0) {
      scrollToField('outputWeightGrams');
      return;
    }

    onCreate({
      roastDate: form.roastDate,
      greenBeanId: form.greenBeanId,
      greenBeanName: form.greenBeanName,
      roastedBeanName: form.roastedBeanName.trim() || form.greenBeanName,
      roastPlanId: form.roastPlanId === '' ? undefined : form.roastPlanId,
      roastPlanName: form.roastPlanName === '' ? undefined : form.roastPlanName,
      inputWeightGrams: form.inputWeightGrams,
      outputWeightGrams: form.outputWeightGrams,
      roastLevel: form.roastLevel,
      developmentRatio: form.developmentRatio,
      firstCrackTime: form.firstCrackTime,
      totalRoastTime: form.totalRoastTime,
      notes: form.notes === '' ? undefined : form.notes,
      imageUrls: [],
    });
  };

  return (
    <div className={styles.creator}>
      <section className={styles.section}>
        <h4>基本信息</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field} data-field-path="roastDate">
            <span className={styles.fieldLabel}>烘焙日期</span>
            <DatePicker
              format={ROAST_DATE_TIME_FORMAT}
              placeholder="选择烘焙日期与时间"
              showTime={{ format: 'HH:mm' }}
              value={toPickerValue(form.roastDate)}
              onChange={(date: Dayjs | null) => {
                setForm((f) => ({
                  ...f,
                  roastDate: date ? date.second(0).millisecond(0).toISOString() : '',
                }));
              }}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field} data-field-path="roastLevel">
            <span className={styles.fieldLabel}>烘焙程度</span>
            <Select
              value={form.roastLevel}
              onChange={(v) => {
                setForm((f) => ({ ...f, roastLevel: v }));
              }}
              options={ROAST_LEVELS.map((l) => ({ label: l, value: l }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </section>

      <section className={styles.section} data-field-path="greenBeanId">
        <h4>生豆选择</h4>
        <Select
          value={form.greenBeanId === '' ? undefined : form.greenBeanId}
          onChange={(beanId) => {
            const bean = beans.find((b) => String(b.id) === beanId);
            setForm((f) => ({
              ...f,
              greenBeanId: beanId,
              greenBeanName: bean?.name ?? '',
              roastPlanId: '',
              roastPlanName: '',
            }));
          }}
          placeholder="选择生豆"
          options={beans.map((b) => ({ label: b.name, value: String(b.id) }))}
          showSearch
          disabled={!hasBeanOptions}
          optionFilterProp="label"
          style={{ width: '100%' }}
        />
      </section>

      <section className={styles.section} data-field-path="roastedBeanName">
        <h4>熟豆名称（可选）</h4>
        <Input
          value={form.roastedBeanName}
          onChange={(event) => {
            setForm((f) => ({ ...f, roastedBeanName: event.target.value }));
          }}
          placeholder={form.greenBeanName === '' ? '未填写时默认继承生豆名称' : form.greenBeanName}
        />
      </section>

      <section className={styles.section} data-field-path="roastPlanId">
        <h4>烘焙计划（可选）</h4>
        <Select
          value={form.roastPlanId === '' ? undefined : form.roastPlanId}
          onChange={(planId) => {
            const plan = availablePlans.find((p) => String(p.id) === planId);
            setForm((f) => ({
              ...f,
              roastPlanId: planId,
              roastPlanName: plan?.name ?? '',
            }));
          }}
          placeholder={form.greenBeanId ? '选择通用计划或当前生豆对应计划' : '请先选择生豆'}
          options={availablePlans.map((plan) => ({
            label: `${plan.name}${String(plan.beanId) === GENERIC_BEAN_ID ? ' · 通用' : ''}`,
            value: String(plan.id),
          }))}
          allowClear
          disabled={!form.greenBeanId}
          style={{ width: '100%' }}
        />
      </section>

      <section className={styles.section}>
        <h4>烘焙数据</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field} data-field-path="inputWeightGrams">
            <span className={styles.fieldLabel}>入豆量 (g)</span>
            <InputNumber
              value={form.inputWeightGrams}
              onChange={(v) => {
                setForm((f) => ({ ...f, inputWeightGrams: v ?? 0 }));
              }}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field} data-field-path="outputWeightGrams">
            <span className={styles.fieldLabel}>出豆量 (g)</span>
            <InputNumber
              value={form.outputWeightGrams}
              onChange={(v) => {
                setForm((f) => ({ ...f, outputWeightGrams: v ?? 0 }));
              }}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field} data-field-path="developmentRatio">
            <span className={styles.fieldLabel}>失水率</span>
            <span className={styles.fieldValue}>{lossRate}%</span>
          </div>
          <div className={styles.field} data-field-path="firstCrackTime">
            <span className={styles.fieldLabel}>发展比 (%)</span>
            <InputNumber
              value={form.developmentRatio}
              onChange={(v) => {
                setForm((f) => ({ ...f, developmentRatio: v ?? undefined }));
              }}
              min={0}
              max={100}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field} data-field-path="totalRoastTime">
            <span className={styles.fieldLabel}>一爆时间 (s)</span>
            <InputNumber
              value={form.firstCrackTime}
              onChange={(v) => {
                setForm((f) => ({ ...f, firstCrackTime: v ?? undefined }));
              }}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>总烘焙时间 (s)</span>
            <InputNumber
              value={form.totalRoastTime}
              onChange={(v) => {
                setForm((f) => ({ ...f, totalRoastTime: v ?? undefined }));
              }}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h4>备注</h4>
        <Input.TextArea
          value={form.notes}
          onChange={(e) => {
            setForm((f) => ({ ...f, notes: e.target.value }));
          }}
          placeholder="记录烘焙心得、调整建议等..."
          rows={3}
        />
      </section>

      <section className={styles.section}>
        <h4>图片记录（预留接口）</h4>
        <div className={styles.imageUploadPlaceholder}>
          <p>点击上传图片（预留接口）</p>
        </div>
      </section>

      <DrawerActionBar>
        {onCancel ? <Button onClick={onCancel}>取消</Button> : null}
        <Button
          block
          className={styles.submitButton}
          disabled={!hasBeanOptions}
          icon={<CoffeeOutlined />}
          onClick={handleSubmit}
          size="large"
          type="primary"
        >
          保存烘焙记录
        </Button>
      </DrawerActionBar>
    </div>
  );
}
