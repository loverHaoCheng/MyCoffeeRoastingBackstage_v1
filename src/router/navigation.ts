export type AppRouteKey =
  | 'bean'
  | 'finance'
  | 'roast'
  | 'roastAssistant'
  | 'production'
  | 'settings';

export interface AppNavigationItem {
  key: AppRouteKey;
  label: string;
  shortLabel: string;
  path: string;
  group?: 'roast';
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
    key: 'roast',
    label: '烘焙计划',
    shortLabel: '烘焙计划',
    path: '/roasts/plan',
    group: 'roast',
  },
  {
    key: 'production',
    label: '烘焙历史',
    shortLabel: '烘焙',
    path: '/roasts/history',
    group: 'roast',
  },
  {
    key: 'roastAssistant',
    label: 'AI 分析',
    shortLabel: 'AI 分析',
    path: '/roast-assistant',
  },
  {
    key: 'finance',
    label: '财务',
    shortLabel: '财务',
    path: '/finance',
  },
  {
    key: 'settings',
    label: '设置',
    shortLabel: '设置',
    path: '/settings',
    showInBottomNav: false,
  },
];
