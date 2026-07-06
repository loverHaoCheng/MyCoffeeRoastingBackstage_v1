export type AppRouteKey =
  | 'bean'
  | 'inventory'
  | 'roast'
  | 'production'
  | 'finance'
  | 'settings';

export interface AppNavigationItem {
  key: AppRouteKey;
  label: string;
  shortLabel: string;
  path: string;
  showInBottomNav?: boolean;
}

export const appNavigationItems: AppNavigationItem[] = [
  {
    key: 'bean',
    label: '生豆库存',
    shortLabel: '生豆库存',
    path: '/beans',
  },
  {
    key: 'inventory',
    label: '库存管理',
    shortLabel: '库存',
    path: '/inventory',
  },
  {
    key: 'roast',
    label: '烘焙计划',
    shortLabel: '烘焙计划',
    path: '/roasts',
  },
  {
    key: 'production',
    label: '烘焙历史',
    shortLabel: '烘焙',
    path: '/production',
  },
  {
    key: 'finance',
    label: '成本核算',
    shortLabel: '核算',
    path: '/finance',
  },
  {
    key: 'settings',
    label: '设置',
    shortLabel: '设置',
    path: '/settings',
  },
];
