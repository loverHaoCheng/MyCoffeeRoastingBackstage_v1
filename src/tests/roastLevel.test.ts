import { describe, expect, it } from 'vitest';

import { resolveRoastLevelFromAgtron } from '@/modules/roast/constants/roastLevel';

describe('Agtron roast level thresholds', () => {
  it.each([
    [90, '极浅烘焙'],
    [80, '浅度烘焙'],
    [70, '中浅烘焙'],
    [60, '中度烘焙'],
    [50, '中深烘焙'],
    [49.9, '深度烘焙'],
  ])('maps %s to %s', (value, expected) => {
    expect(resolveRoastLevelFromAgtron(value)).toBe(expected);
  });

  it.each([Number.NaN, -1, 100.1])('rejects invalid value %s', (value) => {
    expect(resolveRoastLevelFromAgtron(value)).toBeNull();
  });
});
