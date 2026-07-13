import dayjs from 'dayjs';

import { getRoastLevelSuggestion } from '@/modules/roast/constants/roastLevel';

import type { RoastBatchFormState } from './RoastBatchForm';

export const createDefaultRoastBatchFormState = (): RoastBatchFormState => ({
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
  totalRoastTime: undefined,
});
