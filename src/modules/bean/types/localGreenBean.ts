export interface GreenBeanFormInput {
  code: string;
  defaultRoastInputGrams: number;
  displayName: string;
  grade?: null | string;
  harvestSeason?: null | string;
  millName?: null | string;
  notes?: null | string;
  originArea?: null | string;
  originCountry?: null | string;
  originRegion?: null | string;
  processMethod: string;
  purchasedTotalPrice: number;
  purchasedWeightGrams: number;
  remainingWeightGrams: number;
  supplierName?: null | string;
  variety: string;
  altitudeMetersMax?: null | number;
  altitudeMetersMin?: null | number;
  densityGPerL?: null | number;
  moisturePercent?: null | number;
  defaultSaleUnitWeightGrams?: null | number;
  defaultSaleUnitPrice: number;
}

export type GreenBeanCreateInput = GreenBeanFormInput;

export type GreenBeanUpdateInput = GreenBeanFormInput;

export interface GreenBeanEditableDetail extends GreenBeanFormInput {
  beanId: string;
  defaultSaleSpecId?: null | string;
  purchaseBatchId?: null | string;
}

export interface LocalGreenBeanRecord extends GreenBeanCreateInput {
  createdAt: string;
  id: string;
  source: 'local';
  updatedAt: string;
}
