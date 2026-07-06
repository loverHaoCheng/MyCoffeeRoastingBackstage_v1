import { describe, expect, it } from 'vitest';

import {
  normalizeRoastLevel,
  resolveRoastLevelFromDehydrationRate,
} from '@/modules/roast/constants/roastLevel';

describe('roastLevel helpers', () => {
  it('normalizes legacy roast level labels to the new canonical labels', () => {
    expect(normalizeRoastLevel('极浅')).toBe('极浅烘焙');
    expect(normalizeRoastLevel('浅焙')).toBe('浅度烘焙');
    expect(normalizeRoastLevel('肉桂')).toBe('中浅烘焙');
    expect(normalizeRoastLevel('中焙')).toBe('中度烘焙');
    expect(normalizeRoastLevel('深焙')).toBe('深度烘焙');
    expect(normalizeRoastLevel('极深')).toBe('极深烘焙');
  });

  it('derives roast level from dehydration rate thresholds', () => {
    expect(resolveRoastLevelFromDehydrationRate(10)).toBe('极浅烘焙');
    expect(resolveRoastLevelFromDehydrationRate(14)).toBe('浅度烘焙');
    expect(resolveRoastLevelFromDehydrationRate(15)).toBe('中浅烘焙');
    expect(resolveRoastLevelFromDehydrationRate(16)).toBe('中度烘焙');
    expect(resolveRoastLevelFromDehydrationRate(18)).toBe('中深烘焙');
    expect(resolveRoastLevelFromDehydrationRate(20)).toBe('深度烘焙');
    expect(resolveRoastLevelFromDehydrationRate(21)).toBe('极深烘焙');
  });
});
