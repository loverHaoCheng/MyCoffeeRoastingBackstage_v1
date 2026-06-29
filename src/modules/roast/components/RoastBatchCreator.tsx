import { CoffeeOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, InputNumber, Select } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { useRoastPlans } from '@/modules/roast/hooks';
import type { RoastBatchCreateInput } from '@/modules/roast/types/roastBatch';

import styles from './RoastBatchCreator.module.css';

const ROAST_LEVELS = ['极浅', '浅焙', '肉桂', '中浅', '中焙', '中深', '深焙', '极深'];
const ROAST_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm';

const toPickerValue = (value: string) => {
  if (!value) {
    return null;
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed : null;
};

interface RoastBatchCreatorProps {
  onCreate: (input: RoastBatchCreateInput) => void;
}

export function RoastBatchCreator({ onCreate }: RoastBatchCreatorProps) {
  const { data: beans = [] } = useBeans();
  const { data: plans = [] } = useRoastPlans();

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

  const lossRate = form.inputWeightGrams > 0
    ? (((form.inputWeightGrams - form.outputWeightGrams) / form.inputWeightGrams) * 100).toFixed(1)
    : '-';

  const handleSubmit = () => {
    if (!form.greenBeanId) return;
    onCreate({
      roastDate: form.roastDate,
      greenBeanId: form.greenBeanId,
      greenBeanName: form.greenBeanName,
      roastedBeanName: form.roastedBeanName.trim() || form.greenBeanName,
      roastPlanId: form.roastPlanId || undefined,
      roastPlanName: form.roastPlanName || undefined,
      inputWeightGrams: form.inputWeightGrams,
      outputWeightGrams: form.outputWeightGrams,
      roastLevel: form.roastLevel,
      developmentRatio: form.developmentRatio,
      firstCrackTime: form.firstCrackTime,
      totalRoastTime: form.totalRoastTime,
      notes: form.notes || undefined,
      imageUrls: [],
    });
  };

  return (
    <div className={styles.creator}>
      <section className={styles.section}>
        <h4>基本信息</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>烘焙日期</span>
            <DatePicker
              format={ROAST_DATE_TIME_FORMAT}
              placeholder="选择烘焙日期与时间"
              showTime={{ format: 'HH:mm' }}
              value={toPickerValue(form.roastDate)}
              onChange={(date) =>
                setForm((f) => ({
                  ...f,
                  roastDate: date ? date.second(0).millisecond(0).toISOString() : '',
                }))
              }
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>烘焙程度</span>
            <Select
              value={form.roastLevel}
              onChange={(v) => setForm((f) => ({ ...f, roastLevel: v }))}
              options={ROAST_LEVELS.map((l) => ({ label: l, value: l }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h4>生豆选择</h4>
        <Select
          value={form.greenBeanId || undefined}
          onChange={(beanId) => {
            const bean = beans.find((b) => String(b.id) === beanId);
            setForm((f) => ({
              ...f,
              greenBeanId: beanId,
              greenBeanName: bean?.name || '',
            }));
          }}
          placeholder="选择生豆"
          options={beans.map((b) => ({ label: b.name, value: String(b.id) }))}
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
        />
      </section>

      <section className={styles.section}>
        <h4>熟豆名称（可选）</h4>
        <Input
          value={form.roastedBeanName}
          onChange={(event) => setForm((f) => ({ ...f, roastedBeanName: event.target.value }))}
          placeholder={form.greenBeanName || '未填写时默认继承生豆名称'}
        />
      </section>

      <section className={styles.section}>
        <h4>烘焙计划（可选）</h4>
        <Select
          value={form.roastPlanId || undefined}
          onChange={(planId) => {
            const plan = plans.find((p) => String(p.id) === planId);
            setForm((f) => ({
              ...f,
              roastPlanId: planId,
              roastPlanName: plan?.name || '',
            }));
          }}
          placeholder="选择烘焙计划"
          options={plans.map((p) => ({ label: p.name, value: String(p.id) }))}
          allowClear
          style={{ width: '100%' }}
        />
      </section>

      <section className={styles.section}>
        <h4>烘焙数据</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>入豆量 (g)</span>
            <InputNumber
              value={form.inputWeightGrams}
              onChange={(v) => setForm((f) => ({ ...f, inputWeightGrams: v || 0 }))}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>出豆量 (g)</span>
            <InputNumber
              value={form.outputWeightGrams}
              onChange={(v) => setForm((f) => ({ ...f, outputWeightGrams: v || 0 }))}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>失水率</span>
            <span className={styles.fieldValue}>{lossRate}%</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>发展比 (%)</span>
            <InputNumber
              value={form.developmentRatio}
              onChange={(v) => setForm((f) => ({ ...f, developmentRatio: v ?? undefined }))}
              min={0}
              max={100}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>一爆时间 (s)</span>
            <InputNumber
              value={form.firstCrackTime}
              onChange={(v) => setForm((f) => ({ ...f, firstCrackTime: v ?? undefined }))}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>总烘焙时间 (s)</span>
            <InputNumber
              value={form.totalRoastTime}
              onChange={(v) => setForm((f) => ({ ...f, totalRoastTime: v ?? undefined }))}
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
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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

      <Button
        type="primary"
        onClick={handleSubmit}
        disabled={!form.greenBeanId}
        block
        size="large"
        icon={<CoffeeOutlined />}
      >
        保存烘焙记录
      </Button>
    </div>
  );
}
