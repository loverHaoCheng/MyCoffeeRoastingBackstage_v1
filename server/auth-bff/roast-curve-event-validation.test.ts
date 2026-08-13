// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { validateRoastCurveEventOverrideOrder } from './roast-curve-event-validation.js';

const curve = {
  curve_data: [
    { bean_temperature: 190, time_seconds: 0 },
    { bean_temperature: 205, time_seconds: 100 },
    { bean_temperature: 220, time_seconds: 200 },
    { bean_temperature: 230, time_seconds: 300 },
  ],
  event_list: [
    { time_seconds: 0, type: 'charge' },
    { time_seconds: 100, type: 'turningPoint' },
    { time_seconds: 200, type: 'dryEnd' },
    { time_seconds: 300, type: 'drop' },
  ],
};

describe('roast curve event override validation', () => {
  it('rejects reversed event sample indexes', () => {
    expect(validateRoastCurveEventOverrideOrder({
      ...curve,
      event_overrides: {
        charge: { sampleIndex: 2 },
        drop: { sampleIndex: 1 },
      },
    })).toContain('顺序无效');
  });

  it('rejects an out-of-range sample index', () => {
    expect(validateRoastCurveEventOverrideOrder({
      ...curve,
      event_overrides: { drop: { sampleIndex: 99 } },
    })).toContain('有效的曲线采样点');
  });

  it('accepts ordered overrides', () => {
    expect(validateRoastCurveEventOverrideOrder({
      ...curve,
      event_overrides: {
        charge: { sampleIndex: 0 },
        drop: { sampleIndex: 3 },
      },
    })).toBeNull();
  });
});
