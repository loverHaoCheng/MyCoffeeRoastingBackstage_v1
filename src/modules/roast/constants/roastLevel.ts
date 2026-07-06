export const ROAST_LEVEL_OPTIONS = [
  '极浅烘焙',
  '浅度烘焙',
  '中浅烘焙',
  '中度烘焙',
  '中深烘焙',
  '深度烘焙',
  '极深烘焙',
] as const;

export type RoastLevel = (typeof ROAST_LEVEL_OPTIONS)[number];

const roastLevelAliasMap: Record<string, RoastLevel> = {
  '极浅': '极浅烘焙',
  '极浅焙': '极浅烘焙',
  '极浅烘焙': '极浅烘焙',
  '浅焙': '浅度烘焙',
  '浅烘焙': '浅度烘焙',
  '浅度烘焙': '浅度烘焙',
  '浅中焙': '中浅烘焙',
  '肉桂': '中浅烘焙',
  '中浅': '中浅烘焙',
  '中浅焙': '中浅烘焙',
  '中浅烘焙': '中浅烘焙',
  '中焙': '中度烘焙',
  '中度烘焙': '中度烘焙',
  '中深': '中深烘焙',
  '中深焙': '中深烘焙',
  '中深烘焙': '中深烘焙',
  '深焙': '深度烘焙',
  '深度烘焙': '深度烘焙',
  '极深': '极深烘焙',
  '极深焙': '极深烘焙',
  '极深烘焙': '极深烘焙',
  '法式重焙': '极深烘焙',
};

const roastLevelThresholds: { maxLossRate: number; level: RoastLevel }[] = [
  { maxLossRate: 13.5, level: '极浅烘焙' },
  { maxLossRate: 14.5, level: '浅度烘焙' },
  { maxLossRate: 15.5, level: '中浅烘焙' },
  { maxLossRate: 16.5, level: '中度烘焙' },
  { maxLossRate: 18.5, level: '中深烘焙' },
  { maxLossRate: 20.5, level: '深度烘焙' },
];

export const calculateDehydrationRate = (inputWeightGrams: number, outputWeightGrams: number): number => {
  if (inputWeightGrams <= 0) {
    return 0;
  }

  const rate = ((inputWeightGrams - outputWeightGrams) / inputWeightGrams) * 100;

  return Number(rate.toFixed(1));
};

export const normalizeRoastLevel = (value: string | null | undefined): RoastLevel => {
  const nextValue = value?.trim() ?? '';

  if (nextValue.length === 0) {
    return '中度烘焙';
  }

  return roastLevelAliasMap[nextValue] ?? (ROAST_LEVEL_OPTIONS.includes(nextValue as RoastLevel) ? (nextValue as RoastLevel) : '中度烘焙');
};

export const resolveRoastLevelFromDehydrationRate = (dehydrationRate: number): RoastLevel => {
  const safeRate = Number.isFinite(dehydrationRate) ? Math.max(dehydrationRate, 0) : 0;

  for (const threshold of roastLevelThresholds) {
    if (safeRate <= threshold.maxLossRate) {
      return threshold.level;
    }
  }

  return '极深烘焙';
};

export const getRoastLevelSuggestion = (inputWeightGrams: number, outputWeightGrams: number): RoastLevel => {
  return resolveRoastLevelFromDehydrationRate(calculateDehydrationRate(inputWeightGrams, outputWeightGrams));
};
