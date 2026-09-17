export type RoastBatchEditableFieldPath =
  | 'beanAgtronColor'
  | 'developmentRatio'
  | 'firstCrackTime'
  | 'groundAgtronColor'
  | 'greenBeanId'
  | 'inputWeightGrams'
  | 'notes'
  | 'outputWeightGrams'
  | 'roastDate'
  | 'roastLevel'
  | 'roastLevelSource'
  | 'roastPlanId'
  | 'roastedBeanName'
  | 'salesMode'
  | 'soldUnitCount'
  | 'status'
  | 'totalRoastTime';

export const FIELD_LABELS: Record<RoastBatchEditableFieldPath, string> = {
  beanAgtronColor: '咖啡豆表色值',
  developmentRatio: '发展比',
  firstCrackTime: '一爆时间',
  groundAgtronColor: '咖啡粉色值',
  greenBeanId: '生豆',
  inputWeightGrams: '入豆量',
  notes: '备注',
  outputWeightGrams: '出豆量',
  roastDate: '烘焙日期',
  roastLevel: '烘焙程度',
  roastLevelSource: '烘焙程度根据',
  roastPlanId: '烘焙计划',
  roastedBeanName: '熟豆名称',
  salesMode: '去向',
  soldUnitCount: '已售份数',
  status: '状态',
  totalRoastTime: '总烘焙时间',
};
