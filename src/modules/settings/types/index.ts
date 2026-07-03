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

export interface AppDisplaySettings {
  scale: number;
  updatedAt: null | string;
}

export const appDisplayScaleMin = 0.85;
export const appDisplayScaleMax = 1.2;
export const appDisplayScaleStep = 0.05;

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

export const createDefaultCostTemplateSettings = (): CostTemplateSettings => {
  return {
    defaultTemplateId: null,
    templates: [],
    updatedAt: null,
  };
};

export const createDefaultAppDisplaySettings = (): AppDisplaySettings => ({
  scale: 1,
  updatedAt: null,
});
