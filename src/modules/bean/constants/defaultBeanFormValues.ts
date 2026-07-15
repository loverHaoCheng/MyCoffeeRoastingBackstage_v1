import type { GreenBeanCreateInput } from '../types/localGreenBean';

import { getShanghaiDateParts, toShanghaiDateString } from '@/shared/time/shanghaiTime';

export const createDefaultBeanCode = (date = new Date()): string => {
  const parts = getShanghaiDateParts(date);

  if (!parts) {
    return 'EB-0000000000';
  }

  return [
    'EB-',
    parts.year.slice(-2),
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
  ].join('');
};

export const createDefaultBeanFormValues = (): GreenBeanCreateInput => {
  return {
    agingDays: 14,
    costTemplateId: null,
    code: createDefaultBeanCode(),
    defaultRoastInputGrams: 200,
    defaultSaleUnitPrice: 0,
    defaultSaleUnitWeightGrams: null,
    displayName: '',
    flavorTags: [],
    grade: '',
    harvestSeason: '',
    millName: '',
    notes: '',
    originArea: '',
    originCountry: '',
    originRegion: '',
    processMethod: '',
    purchaseDate: toShanghaiDateString(new Date()),
    purchasedTotalPrice: 0,
    purchasedWeightGrams: 1000,
    remainingWeightGrams: 1000,
    supplierName: '',
    tastingEndDays: 40,
    variety: '',
    altitudeMetersMax: null,
    altitudeMetersMin: null,
    densityGPerL: null,
    moisturePercent: null,
  };
};
