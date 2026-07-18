import type { AppCardModuleKey } from '@/modules/settings/types';

export interface CardDisplayMetaOption {
  key: string;
  label: string;
}

export interface CardDisplayModuleDefinition {
  description: string;
  key: AppCardModuleKey;
  label: string;
  metaOptions: CardDisplayMetaOption[];
}

export const beanInventoryCardMetaOptions: CardDisplayMetaOption[] = [
  { key: 'stock', label: '库存' },
  { key: 'cost', label: '成本' },
  { key: 'costTemplateId', label: '成本模板' },
  { key: 'supplier', label: '供应商' },
  { key: 'process', label: '处理法' },
  { key: 'flavorTags', label: '风味' },
  { key: 'originCountry', label: '国家' },
  { key: 'originRegion', label: '产区' },
  { key: 'originArea', label: '小产区' },
  { key: 'millName', label: '处理厂' },
  { key: 'variety', label: '品种' },
  { key: 'grade', label: '等级' },
  { key: 'harvestSeason', label: '产季' },
  { key: 'agingDays', label: '养豆时间' },
  { key: 'tastingEndDays', label: '赏味结束期' },
  { key: 'code', label: '编号' },
  { key: 'defaultRoastInput', label: '默认烘焙量' },
  { key: 'defaultSaleUnitPrice', label: '默认单份售价' },
  { key: 'defaultSaleUnitWeight', label: '默认单份重量' },
  { key: 'purchasedWeight', label: '采购总重' },
  { key: 'purchasedTotalPrice', label: '采购总价' },
  { key: 'remainingWeight', label: '剩余重量' },
  { key: 'altitudeMetersMin', label: '海拔下限' },
  { key: 'altitudeMetersMax', label: '海拔上限' },
  { key: 'moisturePercent', label: '含水率' },
  { key: 'densityGPerL', label: '密度' },
  { key: 'notes', label: '备注' },
];

export const roastBatchCardMetaOptions: CardDisplayMetaOption[] = [
  { key: 'roastDate', label: '烘焙日期' },
  { key: 'greenBean', label: '生豆' },
  { key: 'roastedBean', label: '熟豆' },
  { key: 'salesMode', label: '去向' },
  { key: 'roastPlan', label: '烘焙计划' },
  { key: 'inputWeight', label: '入豆量' },
  { key: 'outputWeight', label: '出豆量' },
  { key: 'lossRate', label: '失水率' },
  { key: 'roastLevel', label: '烘焙程度' },
  { key: 'developmentRatio', label: '发展比' },
  { key: 'firstCrackTime', label: '一爆时间' },
  { key: 'totalRoastTime', label: '总烘焙时间' },
  { key: 'notes', label: '备注' },
  { key: 'status', label: '状态' },
];

export const roastPlanCardMetaOptions: CardDisplayMetaOption[] = [
  { key: 'beanName', label: '生豆' },
  { key: 'roasterModel', label: '烘豆机' },
  { key: 'batchWeight', label: '批次重量' },
  { key: 'plannedBatchWeight', label: '计划重量' },
  { key: 'roastPurpose', label: '用途' },
  { key: 'roastLevel', label: '烘焙目标' },
  { key: 'status', label: '状态' },
  { key: 'stepCount', label: '节点数' },
];

export const cardDisplayModules: CardDisplayModuleDefinition[] = [
  {
    description: '生豆库存卡片',
    key: 'beanInventory',
    label: '生豆库存',
    metaOptions: beanInventoryCardMetaOptions,
  },
  {
    description: '烘焙历史卡片',
    key: 'roastBatch',
    label: '烘焙历史',
    metaOptions: roastBatchCardMetaOptions,
  },
  {
    description: '烘焙计划卡片',
    key: 'roastPlan',
    label: '烘焙计划',
    metaOptions: roastPlanCardMetaOptions,
  },
];
