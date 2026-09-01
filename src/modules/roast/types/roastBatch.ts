/** 烘焙记录领域类型 */
export type RoastBatchSalesMode = 'sale' | 'selfUse';
export type RoastLevelSource = 'beanAgtron' | 'groundAgtron' | 'dehydrationRate' | 'manual';

export interface RoastBatchEvaluation {
  allowTraining: boolean;
  defectNotes?: string;
  flavorNotes?: string;
  nextAdjustmentNotes?: string;
  overallScore?: number;
  targetMatchScore?: number;
}

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
  /** 烘焙程度判断依据 */
  roastLevelSource?: RoastLevelSource;
  /** 咖啡豆表色 Agtron 数值 */
  beanAgtronColor?: number;
  /** 咖啡粉色 Agtron 数值 */
  groundAgtronColor?: number;
  /** 发展比（%） */
  developmentRatio?: number;
  /** 一爆时间（秒） */
  firstCrackTime?: number;
  /** 总烘焙时间（秒） */
  totalRoastTime?: number;
  /** 本次销售单份最终定价，仅影响本次烘焙记录收入 */
  finalSaleUnitPrice?: number | null;
  /** 销售发生时的有效单份售价快照 */
  saleUnitPriceSnapshot?: number | null;
  /** 销售发生时的单份生豆成本快照 */
  beanCostPerSaleUnitSnapshot?: number | null;
  /** 销售发生时的单份包装、能耗及其他成本快照，不含人工费 */
  nonBeanCostPerSaleUnitSnapshot?: number | null;
  /** 已售成品份数，历史记录缺失时按 1 份兼容 */
  soldUnitCount?: number;
  /** 备注 */
  notes?: string;
  /** 评价 */
  evaluation: RoastBatchEvaluation;
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
  roastLevelSource?: RoastLevelSource;
  beanAgtronColor?: number;
  groundAgtronColor?: number;
  developmentRatio?: number;
  firstCrackTime?: number;
  totalRoastTime?: number;
  finalSaleUnitPrice?: number | null;
  saleUnitPriceSnapshot?: number | null;
  beanCostPerSaleUnitSnapshot?: number | null;
  nonBeanCostPerSaleUnitSnapshot?: number | null;
  soldUnitCount?: number;
  notes?: string;
  evaluation?: RoastBatchEvaluation;
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
  roastLevelSource?: RoastLevelSource;
  beanAgtronColor?: number;
  groundAgtronColor?: number;
  developmentRatio?: number;
  firstCrackTime?: number;
  totalRoastTime?: number;
  finalSaleUnitPrice?: number | null;
  saleUnitPriceSnapshot?: number | null;
  beanCostPerSaleUnitSnapshot?: number | null;
  nonBeanCostPerSaleUnitSnapshot?: number | null;
  soldUnitCount?: number;
  notes?: string;
  evaluation?: RoastBatchEvaluation;
  imageUrls?: string[];
  status?: 'completed' | 'draft';
  salesMode?: RoastBatchSalesMode;
}
