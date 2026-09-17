import type { Dispatch, SetStateAction } from 'react';

import InputNumber from '@/shared/components/ui/input-number';
import type { RoastBatchFormState } from './types';

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

interface RoastDataFieldsProps {
  value: RoastBatchFormState;
  onChange: Dispatch<SetStateAction<RoastBatchFormState>>;
  lossRate: string;
}

export function RoastDataFields({ value, onChange, lossRate }: RoastDataFieldsProps) {
  return (
    <section className={styles.section}>
      <h4>烘焙数据</h4>
      <div className={styles.fieldGrid}>
        <div className={styles.field} data-field-path="inputWeightGrams">
          {renderRequiredLabel('入豆量 (g)')}
          <InputNumber
            aria-label="入豆量"
            value={value.inputWeightGrams}
            onChange={(nextValue) => {
              onChange((current) => ({ ...current, inputWeightGrams: nextValue ?? 0 }));
            }}
            min={0}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.field} data-field-path="outputWeightGrams">
          {renderRequiredLabel('出豆量 (g)')}
          <InputNumber
            aria-label="出豆量"
            value={value.outputWeightGrams}
            onChange={(nextValue) => {
              onChange((current) => ({ ...current, outputWeightGrams: nextValue ?? 0 }));
            }}
            min={0}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.field} data-field-path="beanAgtronColor">
          <span className={styles.fieldLabel}>咖啡豆表色值 (Agtron)</span>
          <InputNumber
            aria-label="咖啡豆表色值"
            max={100}
            min={0}
            precision={1}
            value={value.beanAgtronColor}
            onChange={(nextValue) => {
              onChange((current) => ({ ...current, beanAgtronColor: nextValue ?? undefined }));
            }}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.field} data-field-path="groundAgtronColor">
          <span className={styles.fieldLabel}>咖啡粉色值 (Agtron)</span>
          <InputNumber
            aria-label="咖啡粉色值"
            max={100}
            min={0}
            precision={1}
            value={value.groundAgtronColor}
            onChange={(nextValue) => {
              onChange((current) => ({ ...current, groundAgtronColor: nextValue ?? undefined }));
            }}
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
            aria-label="发展比"
            value={value.developmentRatio}
            onChange={(nextValue) => {
              onChange((current) => ({ ...current, developmentRatio: nextValue ?? undefined }));
            }}
            min={0}
            max={100}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.field} data-field-path="totalRoastTime">
          <span className={styles.fieldLabel}>一爆时间 (s)</span>
          <InputNumber
            aria-label="一爆时间"
            value={value.firstCrackTime}
            onChange={(nextValue) => {
              onChange((current) => ({ ...current, firstCrackTime: nextValue ?? undefined }));
            }}
            min={0}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>总烘焙时间 (s)</span>
          <InputNumber
            aria-label="总烘焙时间"
            value={value.totalRoastTime}
            onChange={(nextValue) => {
              onChange((current) => ({ ...current, totalRoastTime: nextValue ?? undefined }));
            }}
            min={0}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </section>
  );
}
