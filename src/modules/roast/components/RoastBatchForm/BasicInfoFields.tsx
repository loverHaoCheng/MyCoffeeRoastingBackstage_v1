import type { Dispatch, SetStateAction } from 'react';

import { AdaptiveDateTimeField } from '@/shared/components/AdaptiveDateTimeField';
import Segmented from 'antd/es/segmented';
import { Select } from '@/shared/components/ui/select';
import type { RoastLevelSource } from '@/modules/roast/types/roastBatch';
import type { RoastBatchFormState } from './types';
import {
  ROAST_LEVEL_OPTIONS,
  ROAST_LEVEL_SOURCE_OPTIONS,
  normalizeRoastLevel,
  resolveRoastLevelFromAgtron,
  resolveRoastLevelFromDehydrationRate,
} from '@/modules/roast/constants/roastLevel';

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

interface BasicInfoFieldsProps {
  value: RoastBatchFormState;
  onChange: Dispatch<SetStateAction<RoastBatchFormState>>;
  dehydrationRate: number;
  suggestedRoastLevel: string;
  normalizedRoastLevel: string;
  roastLevelManualOverrideRef: { current: boolean };
}

export function BasicInfoFields({
  value,
  onChange,
  dehydrationRate,
  suggestedRoastLevel,
  normalizedRoastLevel,
  roastLevelManualOverrideRef,
}: BasicInfoFieldsProps) {
  return (
    <section className={styles.section}>
      <h4>基本信息</h4>
      <div className={styles.fieldGrid}>
        <div className={styles.field} data-field-path="roastDate">
          {renderRequiredLabel('烘焙日期')}
          <AdaptiveDateTimeField
            ariaLabel="烘焙日期"
            mode="datetime"
            placeholder="选择烘焙日期与时间"
            value={value.roastDate}
            onChange={(nextValue) => {
              onChange((current) => ({
                ...current,
                roastDate: nextValue,
              }));
            }}
          />
        </div>
        <div className={styles.field} data-field-path="roastLevel">
          {renderRequiredLabel('烘焙程度')}
          <span className={styles.fieldLabel}>烘焙程度根据</span>
          <Segmented
            block
            options={ROAST_LEVEL_SOURCE_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
            value={value.roastLevelSource}
            onChange={(nextValue) => {
              const nextSource: RoastLevelSource = nextValue;
              const nextLevel = nextSource === 'manual'
                ? value.roastLevel
                : nextSource === 'beanAgtron'
                  ? resolveRoastLevelFromAgtron(value.beanAgtronColor ?? Number.NaN)
                  : nextSource === 'groundAgtron'
                    ? resolveRoastLevelFromAgtron(value.groundAgtronColor ?? Number.NaN)
                    : resolveRoastLevelFromDehydrationRate(dehydrationRate);

              roastLevelManualOverrideRef.current = nextSource === 'manual';
              onChange((current) => ({
                ...current,
                roastLevel: nextLevel ?? current.roastLevel,
                roastLevelSource: nextSource,
              }));
            }}
          />
          <Select
            aria-label="烘焙程度"
            value={normalizedRoastLevel}
            onChange={(nextValue) => {
              roastLevelManualOverrideRef.current = true;
              onChange((current) => ({
                ...current,
                roastLevel: normalizeRoastLevel(nextValue),
                roastLevelSource: 'manual',
              }));
            }}
            options={ROAST_LEVEL_OPTIONS.map((level) => ({ label: level, value: level }))}
            showSearch={false}
            style={{ width: '100%' }}
          />
          <div className={styles.inlineHint}>
            当前判断：{suggestedRoastLevel}；脱水率 {dehydrationRate.toFixed(1)}%
            {value.roastLevelSource === 'beanAgtron' && value.beanAgtronColor == null ? '；请输入咖啡豆表色值后自动判断' : null}
            {value.roastLevelSource === 'groundAgtron' && value.groundAgtronColor == null ? '；请输入咖啡粉色值后自动判断' : null}
          </div>
        </div>
      </div>
    </section>
  );
}
