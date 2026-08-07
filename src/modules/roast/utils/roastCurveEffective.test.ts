import { describe, expect, it } from 'vitest';

import type { RoastCurveRecord } from '@/modules/roast/types/roastCurve';

import { isValidEventOverrideOrder, resolveEffectiveRoastCurve } from './roastCurveEffective';

const rawCurve: RoastCurveRecord = {
  curveData: [
    { beanTemperature: 198.8, timeSeconds: 0 },
    { beanTemperature: 100.3, timeSeconds: 80 },
    { beanTemperature: 160, timeSeconds: 358 },
    { beanTemperature: 206, timeSeconds: 484 },
    { beanTemperature: 220, timeSeconds: 560 },
    { beanTemperature: 231.4, timeSeconds: 572 },
  ],
  eventList: [
    { code: 1, label: '入豆', temperature: 198.8, temperatureUnit: 'C', timeSeconds: 0, type: 'charge' },
    { code: 2, label: '回温点', temperature: 100.3, temperatureUnit: 'C', timeSeconds: 80, type: 'turningPoint' },
    { code: 3, label: '转黄', temperature: 160, temperatureUnit: 'C', timeSeconds: 358, type: 'dryEnd' },
    { code: 4, label: '一爆开始', temperature: 206, temperatureUnit: 'C', timeSeconds: 484, type: 'firstCrackStart' },
    { code: 8, label: '下豆', temperature: 231.4, temperatureUnit: 'C', timeSeconds: 572, type: 'drop' },
  ],
  id: 'curve-1',
  importedAt: '2026-07-29T00:00:00.000Z',
  metrics: { dropTime: 572, roastDuration: 572 },
  phaseList: [],
  roastBatchId: 'batch-1',
  sampleInterval: 2,
  source: 'artisan',
  sourceVersion: '4.2.0',
  temperatureUnit: 'C',
  updatedAt: '2026-07-29T00:00:00.000Z',
};

describe('resolveEffectiveRoastCurve', () => {
  it('uses an edited drop sample to truncate presentation and recompute linked metrics', () => {
    const effective = resolveEffectiveRoastCurve({
      ...rawCurve,
      eventOverrides: { drop: { sampleIndex: 4 } },
    });

    expect(effective.curveData.map((point) => point.timeSeconds)).toEqual([0, 80, 358, 484, 560]);
    expect(effective.metrics).toMatchObject({
      developmentTime: 76,
      dropTemperature: 220,
      dropTime: 560,
      roastDuration: 560,
    });
    expect(effective.metrics.developmentRatio).toBeCloseTo(13.571, 3);
    expect(effective.phaseList.find((phase) => phase.phase === 4)?.percentage).toBeCloseTo(76 / 560, 6);
    expect(effective.eventList.at(-1)).toMatchObject({ timeSeconds: 560, type: 'drop' });
    expect(rawCurve.curveData).toHaveLength(6);
  });

  it('restarts the time axis from an edited charge sample', () => {
    const effective = resolveEffectiveRoastCurve({
      ...rawCurve,
      eventOverrides: { charge: { sampleIndex: 1 } },
    });

    expect(effective.curveData[0]).toMatchObject({ timeSeconds: 0 });
    expect(effective.metrics.roastDuration).toBe(492);
    expect(effective.metrics.firstCrackTime).toBe(404);
  });

  it('rejects overrides that invert the event sequence', () => {
    expect(isValidEventOverrideOrder(rawCurve, {
      firstCrackStart: { sampleIndex: 2 },
      turningPoint: { sampleIndex: 3 },
    })).toBe(false);
  });
});
