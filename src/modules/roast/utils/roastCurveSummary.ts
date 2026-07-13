import type { RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import type { RoastCurveMetrics } from '@/modules/roast/types/roastCurve';

export const toRoastBatchCurveSummaryInput = (
  metrics: RoastCurveMetrics,
): Pick<RoastBatchUpdateInput, 'developmentRatio' | 'firstCrackTime' | 'totalRoastTime'> => ({
  developmentRatio:
    metrics.developmentRatio == null ? undefined : Number(metrics.developmentRatio.toFixed(1)),
  firstCrackTime: metrics.firstCrackTime == null ? undefined : Math.round(metrics.firstCrackTime),
  totalRoastTime: metrics.roastDuration == null ? undefined : Math.round(metrics.roastDuration),
});
