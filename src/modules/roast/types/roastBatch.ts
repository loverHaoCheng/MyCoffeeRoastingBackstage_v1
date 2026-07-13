/** 烘焙记录领域类型 */
export type RoastBatchSalesMode = 'sale' | 'selfUse';

export interface RoastBatchRecord {
  id: string;
  /** 烘焙日期 */
  roastDate: string;
  /** 关联生豆 ID */
  greenBeanId: string;
  /** 关联生豆名称（冗余，便于展示） */
  greenBeanName: string;
  /** 熟豆名称（可选，未填写时默认使用生豆名称） */
  roastedBeanName?: string;
  /** 关联烘焙计划 ID（可选） */
  roastPlanId?: string;
  /** 关联烘焙计划名称（冗余） */
  roastPlanName?: string;
  /** 入豆量（克） */
  inputWeightGrams: number;
  /** 出豆量（克） */
  outputWeightGrams: number;
  /** 烘焙程度 */
  roastLevel: string;
  /** 发展比（%） */
  developmentRatio?: number;
  /** 一爆时间（秒） */
  firstCrackTime?: number;
  /** 总烘焙时间（秒） */
  totalRoastTime?: number;
  /** 本次销售单份最终定价，仅影响本次烘焙记录收入 */
  finalSaleUnitPrice?: number | null;
  /** 备注 */
  notes?: string;
  /** 图片 URL 列表 */
  imageUrls?: string[];
  /** 状态 */
  status: 'completed' | 'draft';
  /** 去向 */
  salesMode: RoastBatchSalesMode;
  createdAt: string;
  updatedAt: string;
}

/** 创建烘焙记录的输入 */
export interface RoastBatchCreateInput {
  roastDate: string;
  greenBeanId: string;
  greenBeanName: string;
  roastedBeanName?: string;
  roastPlanId?: string;
  roastPlanName?: string;
  inputWeightGrams: number;
  outputWeightGrams: number;
  roastLevel: string;
  developmentRatio?: number;
  firstCrackTime?: number;
  totalRoastTime?: number;
  finalSaleUnitPrice?: number | null;
  notes?: string;
  imageUrls?: string[];
  status?: 'completed' | 'draft';
  salesMode?: RoastBatchSalesMode;
}

/** 更新烘焙记录的输入 */
export interface RoastBatchUpdateInput {
  roastDate?: string;
  greenBeanId?: string;
  greenBeanName?: string;
  roastedBeanName?: string;
  roastPlanId?: string;
  roastPlanName?: string;
  inputWeightGrams?: number;
  outputWeightGrams?: number;
  roastLevel?: string;
  developmentRatio?: number;
  firstCrackTime?: number;
  totalRoastTime?: number;
  finalSaleUnitPrice?: number | null;
  notes?: string;
  imageUrls?: string[];
  status?: 'completed' | 'draft';
  salesMode?: RoastBatchSalesMode;
}
