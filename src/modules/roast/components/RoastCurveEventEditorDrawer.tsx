import { useEffect, useMemo, useState } from 'react';

import Button from 'antd/es/button';
import Select from 'antd/es/select';

import { AppDrawer } from '@/shared/components/AppDrawer';
import type { RoastCurveEditableEventType, RoastCurveEventOverrides, RoastCurveRecord } from '@/modules/roast/types/roastCurve';
import { isValidEventOverrideOrder, resolveEffectiveRoastCurve } from '@/modules/roast/utils/roastCurveEffective';

import styles from './RoastCurveEventEditorDrawer.module.css';

interface RoastCurveEventEditorDrawerProps {
  curve: RoastCurveRecord | null;
  eventType: RoastCurveEditableEventType | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (eventOverrides: RoastCurveEventOverrides | undefined) => void;
  open: boolean;
}

const EVENT_LABELS: Record<RoastCurveEditableEventType, string> = {
  charge: '入豆',
  dryEnd: '转黄',
  drop: '下豆',
  firstCrackEnd: '一爆结束',
  firstCrackStart: '一爆开始',
  turningPoint: '回温点',
};

const formatTime = (seconds: number): string => `${String(Math.floor(seconds / 60))}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

const getEventSampleIndex = (curve: RoastCurveRecord, eventType: RoastCurveEditableEventType): number => {
  const overrideIndex = curve.eventOverrides?.[eventType]?.sampleIndex;
  if (overrideIndex != null && curve.curveData[overrideIndex]) return overrideIndex;
  const event = curve.eventList.find((item) => item.type === eventType);
  if (!event) return 0;

  return curve.curveData.reduce((nearestIndex, point, index) => {
    const nearestPoint = curve.curveData[nearestIndex];
    return nearestPoint && Math.abs(point.timeSeconds - event.timeSeconds) < Math.abs(nearestPoint.timeSeconds - event.timeSeconds)
      ? index
      : nearestIndex;
  }, 0);
};

export function RoastCurveEventEditorDrawer({
  curve,
  eventType,
  isSaving = false,
  onClose,
  onSave,
  open,
}: RoastCurveEventEditorDrawerProps) {
  const [draftOverrides, setDraftOverrides] = useState<RoastCurveEventOverrides | undefined>();

  useEffect(() => {
    if (open && curve) {
      setDraftOverrides(curve.eventOverrides);
    }
  }, [curve, open]);

  const selectedIndex = curve && eventType ? getEventSampleIndex({ ...curve, eventOverrides: draftOverrides }, eventType) : undefined;
  const options = useMemo(() => {
    if (!curve || !eventType) return [];

    return curve.curveData
      .map((point, sampleIndex) => ({ point, sampleIndex }))
      .filter(({ sampleIndex }) => isValidEventOverrideOrder(curve, { ...draftOverrides, [eventType]: { sampleIndex } }))
      .map(({ point, sampleIndex }) => ({
        label: `${formatTime(point.timeSeconds)} / ${point.beanTemperature?.toFixed(1) ?? '-'}${curve.temperatureUnit}`,
        value: sampleIndex,
      }));
  }, [curve, draftOverrides, eventType]);
  const preview = useMemo(() => curve ? resolveEffectiveRoastCurve({ ...curve, eventOverrides: draftOverrides }) : null, [curve, draftOverrides]);

  if (!curve || !eventType || selectedIndex == null || !preview) return null;

  const selectedPoint = curve.curveData[selectedIndex];
  const hasOverride = curve.eventOverrides?.[eventType] != null;

  return (
    <AppDrawer destroyOnHidden height="auto" onClose={onClose} open={open} placement="bottom" title={`编辑${EVENT_LABELS[eventType]}`}>
      <section className={styles.content}>
        <label className={styles.field}>
          <span>采样点</span>
          <Select
            options={options}
            value={selectedIndex}
            onChange={(sampleIndex: number) => {
              setDraftOverrides((current) => ({ ...current, [eventType]: { sampleIndex } }));
            }}
          />
        </label>
        <div className={styles.preview}>
          <span>匹配温度 <b>{selectedPoint?.beanTemperature?.toFixed(1) ?? '-'}{curve.temperatureUnit}</b></span>
          <span>总时长 <b>{formatTime(preview.metrics.roastDuration ?? 0)}</b></span>
          <span>发展 <b>{formatTime(preview.metrics.developmentTime ?? 0)} / {preview.metrics.developmentRatio?.toFixed(1) ?? '-'}%</b></span>
        </div>
        <div className={styles.actions}>
          {hasOverride ? (
            <Button onClick={() => {
              setDraftOverrides((current) => {
                const { [eventType]: removedOverride, ...remaining } = current ?? {};
                void removedOverride;
                return Object.keys(remaining).length > 0 ? remaining : undefined;
              });
            }}>
              恢复导入值
            </Button>
          ) : null}
          <Button onClick={onClose}>取消</Button>
          <Button disabled={isSaving} loading={isSaving} type="primary" onClick={() => { onSave(draftOverrides); }}>保存</Button>
        </div>
      </section>
    </AppDrawer>
  );
}
