import { SaveOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, InputNumber, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { useRoastPlans } from '@/modules/roast/hooks';
import {
  ROAST_LEVEL_OPTIONS,
  calculateDehydrationRate,
  getRoastLevelSuggestion,
  normalizeRoastLevel,
  resolveRoastLevelFromDehydrationRate,
} from '@/modules/roast/constants/roastLevel';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { scrollToField } from '@/shared/forms/scrollToField';
import type { RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import { getSelectableRoastPlans, isGenericRoastPlan } from '@/modules/roast/utils/roastPlanSelection';

import styles from './RoastBatchDrawer.module.css';

type DrawerMode = 'view' | 'edit';
const ROAST_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm';

const toPickerValue = (value: string) => {
  if (!value) {
    return null;
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed : null;
};

interface RoastBatchDrawerProps {
  batch: RoastBatchRecord | null;
  mode: DrawerMode;
  onClose: () => void;
  onUpdate?: (batchId: string, input: RoastBatchUpdateInput) => Promise<void> | void;
}

const createFormState = (batch: RoastBatchRecord | null) => ({
  roastDate: batch?.roastDate ?? '',
  greenBeanId: batch?.greenBeanId ?? '',
  greenBeanName: batch?.greenBeanName ?? '',
  roastedBeanName: batch?.roastedBeanName ?? '',
  salesMode: batch?.salesMode ?? 'sale',
  roastPlanId: batch?.roastPlanId ?? '',
  roastPlanName: batch?.roastPlanName ?? '',
  inputWeightGrams: batch?.inputWeightGrams ?? 0,
  outputWeightGrams: batch?.outputWeightGrams ?? 0,
  roastLevel: batch ? normalizeRoastLevel(batch.roastLevel) : getRoastLevelSuggestion(0, 0),
  developmentRatio: batch?.developmentRatio,
  firstCrackTime: batch?.firstCrackTime,
  totalRoastTime: batch?.totalRoastTime,
  notes: batch?.notes ?? '',
});

export function RoastBatchDrawer({ batch, mode, onClose, onUpdate }: RoastBatchDrawerProps) {
  const isView = mode === 'view';
  const { data: beans = [] } = useBeans();
  const { data: plans = [] } = useRoastPlans();
  const roastLevelManualOverrideRef = useRef(false);

  // 编辑模式下的表单状态
  const [form, setForm] = useState(() => createFormState(batch));
  const availablePlans = useMemo(
    () => getSelectableRoastPlans(plans, form.greenBeanId),
    [form.greenBeanId, plans],
  );

  useEffect(() => {
    setForm(createFormState(batch));
    roastLevelManualOverrideRef.current = false;
  }, [batch]);

  const dehydrationRate = useMemo(
    () => calculateDehydrationRate(form.inputWeightGrams, form.outputWeightGrams),
    [form.inputWeightGrams, form.outputWeightGrams],
  );
  const suggestedRoastLevel = useMemo(
    () => resolveRoastLevelFromDehydrationRate(dehydrationRate),
    [dehydrationRate],
  );
  const normalizedRoastLevel = normalizeRoastLevel(form.roastLevel);

  useEffect(() => {
    if (roastLevelManualOverrideRef.current) {
      return;
    }

    setForm((current) =>
      current.roastLevel === suggestedRoastLevel ? current : { ...current, roastLevel: suggestedRoastLevel },
    );
  }, [suggestedRoastLevel]);

  const handleSave = () => {
    if (batch == null || onUpdate == null) return;
    if (!form.roastDate) {
      scrollToField('roastDate');
      return;
    }

    if (!form.greenBeanId) {
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

    const updateInput: RoastBatchUpdateInput = {
      roastDate: form.roastDate,
      greenBeanId: form.greenBeanId,
      greenBeanName: form.greenBeanName,
      roastedBeanName: form.roastedBeanName.trim() || form.greenBeanName,
      salesMode: form.salesMode,
      roastPlanId: form.roastPlanId === '' ? undefined : form.roastPlanId,
      roastPlanName: form.roastPlanName === '' ? undefined : form.roastPlanName,
      inputWeightGrams: form.inputWeightGrams,
      outputWeightGrams: form.outputWeightGrams,
      roastLevel: normalizedRoastLevel,
      developmentRatio: form.developmentRatio,
      firstCrackTime: form.firstCrackTime,
      totalRoastTime: form.totalRoastTime,
      notes: form.notes === '' ? undefined : form.notes,
    };
    onClose();
    void onUpdate(batch.id, updateInput);
  };

  const lossRate = form.inputWeightGrams > 0
    ? (((form.inputWeightGrams - form.outputWeightGrams) / form.inputWeightGrams) * 100).toFixed(1)
    : '-';

  if (!batch) return null;

  return (
    <div className={styles.drawer}>
      {/* 内容区 */}
      <div className={styles.body}>
        {/* 基本信息 */}
        <section className={styles.section}>
          <h4>基本信息</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field} data-field-path="roastDate">
              <span className={styles.fieldLabel}>烘焙日期</span>
              {isView ? (
                <span className={styles.fieldValue}>
                  {toPickerValue(batch.roastDate)?.format(ROAST_DATE_TIME_FORMAT) ?? batch.roastDate}
                </span>
              ) : (
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
              )}
            </div>
            <div className={styles.field} data-field-path="roastLevel">
                  <span className={styles.fieldLabel}>烘焙程度</span>
              {isView ? (
                <span className={styles.fieldValue}>{normalizeRoastLevel(batch.roastLevel)}</span>
              ) : (
                <Select
                  value={normalizedRoastLevel}
                  onChange={(v) => {
                    roastLevelManualOverrideRef.current = true;
                    setForm((f) => ({ ...f, roastLevel: normalizeRoastLevel(v) }));
                  }}
                  options={ROAST_LEVEL_OPTIONS.map((l) => ({ label: l, value: l }))}
                  style={{ width: '100%' }}
                />
              )}
              {!isView ? (
                <div style={{ color: 'var(--app-text-secondary)', fontSize: '12px', marginTop: '8px' }}>
                  自动匹配：{suggestedRoastLevel}，当前脱水率 {dehydrationRate.toFixed(1)}%
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* 生豆信息 */}
        <section className={styles.section}>
          <h4>生豆信息</h4>
          <div className={styles.fieldGrid}>
          <div className={styles.field} data-field-path="greenBeanId">
              <span className={styles.fieldLabel}>生豆</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.greenBeanName}</span>
              ) : (
                <Select
                  disabled={beans.length === 0}
                  onChange={(beanId: string) => {
                    const bean = beans.find((item) => String(item.id) === beanId);
                    setForm((current) => ({
                      ...current,
                      greenBeanId: beanId,
                      greenBeanName: bean?.name ?? '',
                      roastPlanId: '',
                      roastPlanName: '',
                    }));
                  }}
                  options={beans.map((bean) => ({ label: bean.name, value: String(bean.id) }))}
                  placeholder="选择生豆"
                  value={form.greenBeanId === '' ? undefined : form.greenBeanId}
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field} data-field-path="roastedBeanName">
              <span className={styles.fieldLabel}>熟豆名称</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.roastedBeanName ?? batch.greenBeanName}</span>
              ) : (
                <Input
                  value={form.roastedBeanName}
                  onChange={(event) => {
                    setForm((f) => ({ ...f, roastedBeanName: event.target.value }));
                  }}
                  placeholder={form.greenBeanName === '' ? '未填写时默认继承生豆名称' : form.greenBeanName}
                />
              )}
            </div>
            <div className={styles.field} data-field-path="salesMode">
              <span className={styles.fieldLabel}>去向</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.salesMode === 'selfUse' ? '自留' : '销售'}</span>
              ) : (
                <Select
                  value={form.salesMode}
                  onChange={(value: 'sale' | 'selfUse') => {
                    setForm((current) => ({ ...current, salesMode: value }));
                  }}
                  options={[
                    { label: '销售', value: 'sale' },
                    { label: '自留', value: 'selfUse' },
                  ]}
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field} data-field-path="roastPlanId">
              <span className={styles.fieldLabel}>烘焙计划</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.roastPlanName?.trim() ?? '未关联'}</span>
              ) : (
                <Select
                  allowClear
                  value={form.roastPlanId === '' ? undefined : form.roastPlanId}
                  onChange={(planId: string | undefined) => {
                    const plan = availablePlans.find((item) => String(item.id) === planId);
                    setForm((current) => ({
                      ...current,
                      roastPlanId: planId ?? '',
                      roastPlanName: plan?.name ?? '',
                    }));
                  }}
                  placeholder={form.greenBeanId ? '选择通用计划或当前生豆对应计划' : '可先选择通用计划'}
                  options={availablePlans.map((plan) => ({
                    label: `${plan.name}${isGenericRoastPlan(plan) ? ' · 通用' : ''}`,
                    value: String(plan.id),
                  }))}
                  disabled={availablePlans.length === 0}
                  style={{ width: '100%' }}
                />
              )}
            </div>
          </div>
        </section>

        {/* 烘焙数据 */}
        <section className={styles.section}>
          <h4>烘焙数据</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field} data-field-path="inputWeightGrams">
              <span className={styles.fieldLabel}>入豆量 (g)</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.inputWeightGrams} g</span>
              ) : (
                <InputNumber
                  value={form.inputWeightGrams}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, inputWeightGrams: v ?? 0 }));
                  }}
                  min={0}
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field} data-field-path="outputWeightGrams">
              <span className={styles.fieldLabel}>出豆量 (g)</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.outputWeightGrams} g</span>
              ) : (
                <InputNumber
                  value={form.outputWeightGrams}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, outputWeightGrams: v ?? 0 }));
                  }}
                  min={0}
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field} data-field-path="developmentRatio">
              <span className={styles.fieldLabel}>失水率</span>
              <span className={styles.fieldValue}>{lossRate}%</span>
            </div>
            <div className={styles.field} data-field-path="firstCrackTime">
              <span className={styles.fieldLabel}>发展比 (%)</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.developmentRatio ?? '-'}%</span>
              ) : (
                <InputNumber
                  value={form.developmentRatio}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, developmentRatio: v ?? undefined }));
                  }}
                  min={0}
                  max={100}
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field} data-field-path="totalRoastTime">
              <span className={styles.fieldLabel}>一爆时间 (s)</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.firstCrackTime ?? '-'} s</span>
              ) : (
                <InputNumber
                  value={form.firstCrackTime}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, firstCrackTime: v ?? undefined }));
                  }}
                  min={0}
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>总烘焙时间 (s)</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.totalRoastTime ?? '-'} s</span>
              ) : (
                <InputNumber
                  value={form.totalRoastTime}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, totalRoastTime: v ?? undefined }));
                  }}
                  min={0}
                  style={{ width: '100%' }}
                />
              )}
            </div>
          </div>
        </section>

        {/* 备注 */}
        <section className={styles.section}>
          <h4>备注</h4>
          {isView ? (
            <p className={styles.notes}>{batch.notes ?? '暂无备注'}</p>
          ) : (
            <Input.TextArea
              value={form.notes}
              onChange={(e) => {
                setForm((f) => ({ ...f, notes: e.target.value }));
              }}
              placeholder="记录烘焙心得、调整建议等..."
              rows={3}
            />
          )}
        </section>

        {/* 图片记录（预留接口） */}
        <section className={styles.section}>
          <h4>图片记录</h4>
          {isView ? (
            batch.imageUrls?.length ? (
              <div className={styles.imageGrid}>
                {batch.imageUrls.map((url, i) => (
                  <div key={i} className={styles.imagePlaceholder}>
                    <img src={url} alt={`烘焙记录图片 ${String(i + 1)}`} />
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyText}>暂无图片</p>
            )
          ) : (
            <div className={styles.imageUploadPlaceholder}>
              <p>点击上传图片（预留接口）</p>
            </div>
          )}
        </section>

        {/* 底部操作栏（编辑模式） */}
        {!isView && (
          <DrawerActionBar compact>
            <Button block onClick={onClose}>
              取消
            </Button>
            <Button aria-label="保存烘焙记录" block icon={<SaveOutlined />} onClick={handleSave} type="primary">
              保存烘焙记录
            </Button>
          </DrawerActionBar>
        )}

      </div>
    </div>
  );
}
