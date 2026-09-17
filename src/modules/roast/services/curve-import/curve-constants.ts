import type { RoastCurveEventType } from '../../types/roastCurve';

export const HIBEAN_EVENT_META: Record<number, { label: string; type: RoastCurveEventType }> = {
  0: { label: '预热', type: 'preheat' },
  1: { label: '入豆', type: 'charge' },
  2: { label: '回温点', type: 'turningPoint' },
  3: { label: '脱水结束', type: 'dryEnd' },
  4: { label: '一爆开始', type: 'firstCrackStart' },
  5: { label: '一爆结束', type: 'firstCrackEnd' },
  8: { label: '下豆', type: 'drop' },
};

export const HIBEAN_PHASE_LABELS: Record<number, string> = {
  2: '脱水',
  3: '梅纳',
  4: '发展',
};

export const ARTISAN_EVENT_META: Record<
  string,
  { btKey: string; code: number; etKey: string; label: string; timeKey: string; type: RoastCurveEventType }
> = {
  charge: {
    btKey: 'CHARGE_BT',
    code: 1,
    etKey: 'CHARGE_ET',
    label: '入豆',
    timeKey: 'CHARGE_time',
    type: 'charge',
  },
  turningPoint: {
    btKey: 'TP_BT',
    code: 2,
    etKey: 'TP_ET',
    label: '回温点',
    timeKey: 'TP_time',
    type: 'turningPoint',
  },
  dryEnd: {
    btKey: 'DRY_BT',
    code: 3,
    etKey: 'DRY_ET',
    label: '脱水结束',
    timeKey: 'DRY_time',
    type: 'dryEnd',
  },
  firstCrackStart: {
    btKey: 'FCs_BT',
    code: 4,
    etKey: 'FCs_ET',
    label: '一爆开始',
    timeKey: 'FCs_time',
    type: 'firstCrackStart',
  },
  firstCrackEnd: {
    btKey: 'FCe_BT',
    code: 5,
    etKey: 'FCe_ET',
    label: '一爆结束',
    timeKey: 'FCe_time',
    type: 'firstCrackEnd',
  },
  drop: {
    btKey: 'DROP_BT',
    code: 8,
    etKey: 'DROP_ET',
    label: '下豆',
    timeKey: 'DROP_time',
    type: 'drop',
  },
};

export const ARTISAN_PHASE_META = [
  { durationKey: 'dryphasetime', label: '脱水', phase: 2 },
  { durationKey: 'midphasetime', label: '梅纳', phase: 3 },
  { durationKey: 'finishphasetime', label: '发展', phase: 4 },
] as const;
