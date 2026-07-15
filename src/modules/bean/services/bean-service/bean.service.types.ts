import type { ApiResponse } from '@/services/api.types';
import type { Bean } from '@/types/domain';

import type { GreenBeanCreateInput, GreenBeanEditableDetail, GreenBeanUpdateInput } from '../../types';

export type RoastPlanDisposition = 'delete' | 'makeGeneric';

export interface GreenBeanTableUpdateInput {
  aging_days?: number;
  altitude_meters_max?: null | number;
  altitude_meters_min?: null | number;
  code?: string;
  default_roast_input_grams?: number;
  density_g_per_l?: null | number;
  display_name?: string;
  flavor_tags?: null | string;
  grade?: null | string;
  harvest_season?: null | string;
  mill_name?: null | string;
  moisture_percent?: null | number;
  notes?: null | string;
  origin_area?: null | string;
  origin_country?: null | string;
  origin_region?: null | string;
  process_method?: string;
  tasting_end_days?: number;
  variety?: string;
}

export interface EditablePurchaseBatchInput {
  purchase_date: string;
  purchased_total_price: number;
  purchased_weight_grams: number;
  remaining_weight_grams: number;
  supplier_name?: null | string;
}

export interface BeanRepository {
  adjustRemainingWeight(beanId: string | number, deltaGrams: number): Promise<ApiResponse<Bean>>;
  createBean(input: GreenBeanCreateInput): Promise<ApiResponse<Bean>>;
  deleteBean(beanId: string | number, roastPlanDisposition: RoastPlanDisposition): Promise<void>;
  getBeanById(beanId: string | number): Promise<ApiResponse<Bean | null>>;
  getEditableBean(beanId: string | number): Promise<ApiResponse<GreenBeanEditableDetail>>;
  listBeans(): Promise<ApiResponse<Bean[]>>;
  syncBeans(): Promise<ApiResponse<Bean[]>>;
  updateBean(beanId: string | number, input: GreenBeanUpdateInput): Promise<ApiResponse<Bean>>;
}

export interface RemoteBeanRecord {
  aging_days?: number;
  cost_per_kg: number;
  created_at: string;
  flavor_tags?: null | string;
  grade: string;
  id: number;
  name: string;
  origin: string;
  process: string;
  stock_kg: number;
  supplier_id: number;
  tasting_end_days?: number;
  updated_at: string;
}

export interface RemoteGreenBeanInventoryRecord {
  aging_days?: number;
  altitude_meters_max: null | number;
  altitude_meters_min: null | number;
  code: string;
  cost_template_id: null | string;
  created_at: string;
  default_roast_input_grams: number;
  default_sale_unit_price: null | number;
  default_sale_unit_weight_grams: null | number;
  density_g_per_l: null | number;
  display_name: string;
  flavor_tags?: null | string;
  grade: null | string;
  harvest_season: string;
  id: string;
  latest_purchase_date?: null | string;
  latest_supplier_name?: null | string;
  mill_name: null | string;
  moisture_percent: null | number;
  notes: null | string;
  origin_area: null | string;
  origin_country: string;
  origin_region: string;
  process_method: string;
  roast_record_count: number;
  tasting_end_days?: number;
  total_purchased_price: number;
  total_purchased_weight_grams: number;
  total_remaining_weight_grams: number;
  updated_at: string;
  variety: string;
  weighted_cost_per_kg: number;
}

export interface RemoteGreenBeanRecord {
  aging_days?: number;
  altitude_meters_max: null | number;
  altitude_meters_min: null | number;
  code: string;
  created_at: string;
  default_roast_input_grams: number;
  density_g_per_l: null | number;
  display_name: string;
  flavor_tags?: null | string;
  grade: null | string;
  harvest_season: null | string;
  id: string;
  mill_name: null | string;
  moisture_percent: null | number;
  notes: null | string;
  origin_area: null | string;
  origin_country: null | string;
  origin_region: null | string;
  process_method: string;
  tasting_end_days?: number;
  updated_at: string;
  variety: string;
}

export interface RemotePurchaseBatchRecord {
  created_at?: string;
  green_bean_id?: string;
  id: string;
  purchased_total_price: number;
  purchased_weight_grams: number;
  received_at?: string;
  remaining_weight_grams: number;
  supplier_name: null | string;
  updated_at?: string;
}

export interface RemoteSaleSpecRecord {
  created_at?: string;
  green_bean_id?: string;
  id: string;
  is_default?: boolean;
  unit_price: number;
  unit_weight_grams: number;
  updated_at?: string;
}

export interface RemoteRoastBatchOverviewRecord {
  green_bean_id: string;
  id: string;
  updated_at?: string;
}

export interface RemoteAppSettingRecord {
  id: string;
  key: string;
  updated_at?: null | string;
  value: unknown;
}

export interface BeanSaleDefaultsSettingValue {
  defaultSaleUnitPrice: number;
  defaultSaleUnitWeightGrams: null | number;
  updatedAt?: null | string;
}

export interface BeanCostTemplateSettingValue {
  costTemplateId: null | string;
  updatedAt?: null | string;
}

export interface BeanGradeSettingValue {
  grade: null | string;
  updatedAt?: null | string;
}

export interface RemoteErrorLike {
  message: string;
}

export interface RemoteQueryResult<T> {
  data: T[] | null;
  error: RemoteErrorLike | null;
}

export interface RemoteBeanSelectBuilder {
  order(column: string, options?: { ascending?: boolean }): Promise<RemoteQueryResult<RemoteBeanRecord>>;
}

export interface RemoteBeanTable {
  select(columns: string): RemoteBeanSelectBuilder;
}

export interface RemoteBeanClient {
  from(tableName: string): RemoteBeanTable;
}
