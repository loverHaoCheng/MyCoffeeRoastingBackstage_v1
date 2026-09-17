import type { Dispatch, SetStateAction } from 'react';

import { Select } from '@/shared/components/ui/select';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';
import type { Bean } from '@/types/domain';
import type { RoastPlan } from '@/types/domain';
import type { RoastBatchFormState } from './types';
import { isGenericRoastPlan } from '@/modules/roast/utils/roastPlanSelection';

import styles from './RoastBatchForm.module.css';

const renderRequiredLabel = (label: string) => {
  return (
    <span className={styles.fieldLabel}>
      {label}
      <em aria-hidden="true" className={styles.requiredMark}>
        *
      </em>
    </span>
  );
};

interface GreenBeanFieldsProps {
  value: RoastBatchFormState;
  onChange: Dispatch<SetStateAction<RoastBatchFormState>>;
  beans: Bean[];
  selectedBean: Bean | null;
  availablePlans: RoastPlan[];
  maximumSoldUnitCount: number | null;
}

export function GreenBeanFields({
  value,
  onChange,
  beans,
  selectedBean,
  availablePlans,
  maximumSoldUnitCount,
}: GreenBeanFieldsProps) {
  return (
    <section className={styles.section}>
      <h4>生豆信息</h4>
      <div className={styles.fieldGrid}>
        <div className={styles.field} data-field-path="greenBeanId">
          {renderRequiredLabel('生豆')}
          <Select
            aria-label="生豆"
            disabled={beans.length === 0}
            onChange={(beanId) => {
              if (!beanId) {
                return;
              }

              const bean = beans.find((item) => String(item.id) === beanId);

              onChange((current) => ({
                ...current,
                finalSaleUnitPrice:
                  current.salesMode === 'sale' ? bean?.defaultSaleUnitPrice ?? undefined : current.finalSaleUnitPrice,
                greenBeanId: beanId,
                greenBeanName: bean?.name ?? '',
                roastPlanId: '',
                roastPlanName: '',
              }));
            }}
            options={beans.map((bean) => ({ label: bean.name, value: String(bean.id) }))}
            placeholder="选择生豆"
            showSearch={false}
            value={value.greenBeanId === '' ? undefined : value.greenBeanId}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.field} data-field-path="roastedBeanName">
          <span className={styles.fieldLabel}>熟豆名称</span>
          <Input
            aria-label="熟豆名称"
            value={value.roastedBeanName}
            onChange={(event) => {
              onChange((current) => ({ ...current, roastedBeanName: event.target.value }));
            }}
            placeholder={value.greenBeanName === '' ? '未填写时默认继承生豆名称' : value.greenBeanName}
          />
        </div>
        <div className={styles.field} data-field-path="salesMode">
          <span className={styles.fieldLabel}>去向</span>
          <Select
            aria-label="去向"
            value={value.salesMode}
            onChange={(nextValue) => {
              if (!nextValue) {
                return;
              }

              onChange((current) => ({
                ...current,
                finalSaleUnitPrice:
                  nextValue === 'sale' ? current.finalSaleUnitPrice ?? selectedBean?.defaultSaleUnitPrice ?? undefined : undefined,
                salesMode: nextValue,
              }));
            }}
            options={[
              { label: '销售', value: 'sale' },
              { label: '自留', value: 'selfUse' },
            ]}
            showSearch={false}
            style={{ width: '100%' }}
          />
        </div>
        {value.salesMode === 'sale' ? (
          <div className={styles.field} data-field-path="soldUnitCount">
            <span className={styles.fieldLabel}>已售份数</span>
            <InputNumber
              aria-label="已售份数"
              min={0}
              max={maximumSoldUnitCount ?? undefined}
              precision={0}
              value={value.soldUnitCount}
              onChange={(nextValue) => {
                onChange((current) => ({
                  ...current,
                  soldUnitCount: nextValue ?? 0,
                }));
              }}
              style={{ width: '100%' }}
            />
            <div className={styles.inlineHint}>
              {maximumSoldUnitCount == null
                ? '选择已关联成本模板的生豆后，可计算最多可售份数。'
                : `本锅最多可售 ${String(maximumSoldUnitCount)} 份；已实现收入与生豆成本按已售份数计算。`}
            </div>
          </div>
        ) : null}
        {value.salesMode === 'sale' ? (
          <div className={styles.field} data-field-path="finalSaleUnitPrice">
            <span className={styles.fieldLabel}>本次最终定价</span>
            <InputNumber
              aria-label="本次最终定价"
              min={0}
              precision={2}
              prefix="¥"
              value={value.finalSaleUnitPrice}
              onChange={(nextValue) => {
                onChange((current) => ({
                  ...current,
                  finalSaleUnitPrice: nextValue ?? undefined,
                }));
              }}
              style={{ width: '100%' }}
            />
            <div className={styles.inlineHint}>
              默认取生豆最终定价，只影响本次烘焙记录收入。
            </div>
          </div>
        ) : null}
        <div className={styles.field} data-field-path="roastPlanId">
          <span className={styles.fieldLabel}>烘焙计划</span>
          <Select
            aria-label="烘焙计划"
            allowClear
            value={value.roastPlanId === '' ? undefined : value.roastPlanId}
            onChange={(planId: string | undefined) => {
              const plan = availablePlans.find((item) => String(item.id) === planId);

              onChange((current) => ({
                ...current,
                roastPlanId: planId ?? '',
                roastPlanName: plan?.name ?? '',
              }));
            }}
            placeholder={value.greenBeanId ? '选择通用计划或当前生豆对应计划' : '可先选择通用计划'}
            options={availablePlans.map((plan) => ({
              label: `${plan.name}${isGenericRoastPlan(plan) ? ' · 通用' : ''}`,
              value: String(plan.id),
            }))}
            disabled={availablePlans.length === 0}
            showSearch={false}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </section>
  );
}
