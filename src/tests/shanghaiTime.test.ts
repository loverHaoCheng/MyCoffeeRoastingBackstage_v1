import { describe, expect, it } from 'vitest';

import {
  formatShanghaiBuildVersion,
  formatShanghaiDateTime,
  toShanghaiDateString,
} from '@/shared/time/shanghaiTime';

describe('shanghaiTime', () => {
  it('formats UTC instants in Shanghai time', () => {
    expect(formatShanghaiDateTime('2026-07-13T08:34:33.531Z')).toBe('2026-07-13 16:34:33');
    expect(toShanghaiDateString('2026-07-13T16:30:00.000Z')).toBe('2026-07-14');
  });

  it('formats timestamped build versions for display without changing opaque versions', () => {
    expect(formatShanghaiBuildVersion('0.1.0-2026-07-13T08:34:33.531Z')).toBe(
      '0.1.0 · 2026-07-13 16:34:33 北京时间',
    );
    expect(formatShanghaiBuildVersion('0.1.0-initial')).toBe('0.1.0-initial');
  });
});
