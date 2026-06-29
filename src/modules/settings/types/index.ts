export type SupabaseDataSource = 'greenBean' | 'roastedBean';

export interface SupabaseProjectConnection {
  projectUrl: string;
  publishableKey: string;
}

export interface SupabaseConnectionSettings {
  greenBean: SupabaseProjectConnection;
  roastedBean: SupabaseProjectConnection;
  updatedAt: null | string;
}

export type SupabaseConnectionFormValues = Omit<SupabaseConnectionSettings, 'updatedAt'>;

export interface CostTemplate {
  createdAt: string;
  dehydrationRate: number;
  energyCost: number;
  id: string;
  laborCost: number;
  name: string;
  notes: string;
  otherCost: number;
  packagingCost: number;
  roastInputWeightGrams: number;
  saleUnitWeightGrams: number;
  targetProfitRate: number;
  updatedAt: string;
}

export interface CostTemplateSettings {
  defaultTemplateId: null | string;
  templates: CostTemplate[];
  updatedAt: null | string;
}

export interface CostTemplateFormValues {
  dehydrationRate: number;
  energyCost: number;
  laborCost: number;
  name: string;
  notes: string;
  otherCost: number;
  packagingCost: number;
  roastInputWeightGrams: number;
  saleUnitWeightGrams: number;
  targetProfitRate: number;
}

export const createEmptySupabaseProjectConnection = (): SupabaseProjectConnection => ({
  projectUrl: '',
  publishableKey: '',
});

export const createDefaultSupabaseConnectionSettings = (): SupabaseConnectionSettings => ({
  greenBean: createEmptySupabaseProjectConnection(),
  roastedBean: createEmptySupabaseProjectConnection(),
  updatedAt: null,
});

export const createEmptyCostTemplateFormValues = (): CostTemplateFormValues => ({
  dehydrationRate: 14,
  energyCost: 0,
  laborCost: 0,
  name: '',
  notes: '',
  otherCost: 0,
  packagingCost: 0,
  roastInputWeightGrams: 200,
  saleUnitWeightGrams: 100,
  targetProfitRate: 30,
});

export const createDefaultCostTemplate = (): CostTemplate => {
  const timestamp = new Date().toISOString();

  return {
    createdAt: timestamp,
    dehydrationRate: 14,
    energyCost: 0,
    id: 'default-retail-100g',
    laborCost: 0,
    name: '默认零售 100g',
    notes: '',
    otherCost: 0,
    packagingCost: 0,
    roastInputWeightGrams: 200,
    saleUnitWeightGrams: 100,
    targetProfitRate: 30,
    updatedAt: timestamp,
  };
};

export const createDefaultCostTemplateSettings = (): CostTemplateSettings => {
  const defaultTemplate = createDefaultCostTemplate();

  return {
    defaultTemplateId: defaultTemplate.id,
    templates: [defaultTemplate],
    updatedAt: defaultTemplate.updatedAt,
  };
};
