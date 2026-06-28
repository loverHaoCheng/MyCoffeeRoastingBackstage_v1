export type AppRouteKey = 'dashboard' | 'bean' | 'roast' | 'production' | 'finance';

export interface AppNavigationItem {
  key: AppRouteKey;
  label: string;
  shortLabel: string;
  path: string;
}

export const appNavigationItems: AppNavigationItem[] = [
  {
    key: 'dashboard',
    label: '工作台',
    shortLabel: '工作台',
    path: '/dashboard',
  },
  {
    key: 'bean',
    label: '生豆库存',
    shortLabel: '生豆库存',
    path: '/beans',
  },
  {
    key: 'roast',
    label: '烘焙计划',
    shortLabel: '烘焙计划',
    path: '/roasts',
  },
  {
    key: 'production',
    label: '生产批次',
    shortLabel: '生产',
    path: '/production',
  },
  {
    key: 'finance',
    label: '成本分析',
    shortLabel: '成本',
    path: '/finance',
  },
];
