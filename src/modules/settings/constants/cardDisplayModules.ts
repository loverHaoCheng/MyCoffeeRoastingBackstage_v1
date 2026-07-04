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

export const cardDisplayModules: CardDisplayModuleDefinition[] = [
  {
    description: '生豆库存卡片',
    key: 'beanInventory',
    label: '生豆库存',
    metaOptions: [
      { key: 'stock', label: '库存' },
      { key: 'cost', label: '成本' },
      { key: 'supplier', label: '供应商' },
      { key: 'process', label: '处理法' },
    ],
  },
  {
    description: '烘焙批次卡片',
    key: 'roastBatch',
    label: '烘焙批次',
    metaOptions: [
      { key: 'inputWeight', label: '入豆量' },
      { key: 'outputWeight', label: '出豆量' },
      { key: 'lossRate', label: '失水率' },
      { key: 'roastPlan', label: '烘焙计划' },
    ],
  },
  {
    description: '烘焙计划卡片',
    key: 'roastPlan',
    label: '烘焙计划',
    metaOptions: [
      { key: 'beanName', label: '生豆' },
      { key: 'batchWeight', label: '批次重量' },
      { key: 'roastLevel', label: '烘焙度' },
      { key: 'status', label: '状态' },
    ],
  },
];
