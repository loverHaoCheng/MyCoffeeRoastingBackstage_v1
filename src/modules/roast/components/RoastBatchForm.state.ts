import dayjs from 'dayjs';

import { getRoastLevelSuggestion } from '@/modules/roast/constants/roastLevel';
import { createDefaultRoastBatchEvaluation } from '@/modules/roast/services/roast-batch/roastBatch.service.shared';

import type { RoastBatchFormState } from './RoastBatchForm';

export const createDefaultRoastBatchFormState = (): RoastBatchFormState => ({
  evaluation: createDefaultRoastBatchEvaluation(),
  developmentRatio: undefined,
  firstCrackTime: undefined,
  finalSaleUnitPrice: undefined,
  greenBeanId: '',
  greenBeanName: '',
  inputWeightGrams: 200,
  notes: '',
  outputWeightGrams: 180,
  roastDate: dayjs().second(0).millisecond(0).toISOString(),
  roastLevel: getRoastLevelSuggestion(200, 180),
  roastPlanId: '',
  roastPlanName: '',
  roastedBeanName: '',
  salesMode: 'sale',
  soldUnitCount: 1,
  totalRoastTime: undefined,
});
