import type { GreenBeanCreateInput } from '../types/localGreenBean';

const padTwoDigits = (value: number): string => {
  return String(value).padStart(2, '0');
};

export const createDefaultBeanCode = (date = new Date()): string => {
  return [
    'EB-',
    padTwoDigits(date.getFullYear() % 100),
    padTwoDigits(date.getMonth() + 1),
    padTwoDigits(date.getDate()),
    padTwoDigits(date.getHours()),
    padTwoDigits(date.getMinutes()),
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
    purchaseDate: new Date().toISOString().slice(0, 10),
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
