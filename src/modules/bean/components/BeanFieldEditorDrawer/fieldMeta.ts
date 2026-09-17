export type BeanEditableFieldPath =
  | 'code'
  | 'altitudeMetersMax'
  | 'altitudeMetersMin'
  | 'agingDays'
  | 'costTemplateId'
  | 'defaultRoastInputGrams'
  | 'defaultSaleUnitPrice'
  | 'defaultSaleUnitWeightGrams'
  | 'densityGPerL'
  | 'flavorTags'
  | 'grade'
  | 'harvestSeason'
  | 'millName'
  | 'moisturePercent'
  | 'notes'
  | 'originArea'
  | 'originCountry'
  | 'originRegion'
  | 'processMethod'
  | 'purchasedTotalPrice'
  | 'purchasedWeightGrams'
  | 'remainingWeightGrams'
  | 'supplierName'
  | 'tastingEndDays'
  | 'variety';

export const fieldMeta: Record<
  BeanEditableFieldPath,
  {
    label: string;
    placeholder: string;
  }
> = {
  altitudeMetersMax: { label: '海拔上限', placeholder: '例如 2200' },
  altitudeMetersMin: { label: '海拔下限', placeholder: '例如 1800' },
  agingDays: { label: '养豆时间', placeholder: '例如 14' },
  code: { label: '生豆编号', placeholder: '例如 GB-2026-001' },
  costTemplateId: { label: '成本模板', placeholder: '选择一个成本模板' },
  defaultRoastInputGrams: { label: '默认烘焙量', placeholder: '例如 200' },
  defaultSaleUnitPrice: { label: '默认单份售价', placeholder: '例如 48' },
  defaultSaleUnitWeightGrams: { label: '默认单份重量', placeholder: '例如 250' },
  densityGPerL: { label: '密度', placeholder: '例如 680' },
  flavorTags: { label: '风味', placeholder: '输入后按回车生成标签,也支持逗号分隔' },
  grade: { label: '等级', placeholder: '例如 G1 / SHB / AA' },
  harvestSeason: { label: '产季', placeholder: '例如 2025/26' },
  millName: { label: '处理厂', placeholder: '例如 某某处理厂' },
  moisturePercent: { label: '含水率', placeholder: '例如 10.5' },
  notes: { label: '备注', placeholder: '填写补充说明' },
  originArea: { label: '产地小产区', placeholder: '例如 艾瑞莎' },
  originCountry: { label: '产地', placeholder: '例如 埃塞俄比亚' },
  originRegion: { label: '产区', placeholder: '例如 古吉' },
  processMethod: { label: '处理法', placeholder: '例如 水洗 / 日晒 / 厌氧' },
  purchasedTotalPrice: { label: '购买总价', placeholder: '例如 1280' },
  purchasedWeightGrams: { label: '购买总重', placeholder: '例如 1000' },
  remainingWeightGrams: { label: '剩余重量', placeholder: '例如 9600' },
  supplierName: { label: '供应商', placeholder: '例如 Nordic Approach' },
  tastingEndDays: { label: '赏味结束期', placeholder: '例如 40' },
  variety: { label: '豆种', placeholder: '例如 Heirloom / SL28 SL34' },
};
