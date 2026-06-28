import type { DashboardOverview } from '@/modules/dashboard/types';

export const dashboardOverview: DashboardOverview = {
  metrics: [
    {
      id: 'planned-batches',
      label: '待烘焙批次',
      value: '8',
      trend: '今日新增 2 批',
      tone: 'green',
    },
    {
      id: 'green-bean-stock',
      label: '生豆库存',
      value: '1,260 kg',
      trend: '可覆盖 18 天',
      tone: 'blue',
    },
    {
      id: 'weekly-output',
      label: '本周产量',
      value: '342 kg',
      trend: '较上周 +12%',
      tone: 'amber',
    },
    {
      id: 'avg-cost',
      label: '成本均价',
      value: '58.4 元/kg',
      trend: '环比 -3.1%',
      tone: 'red',
    },
  ],
  roastTasks: [
    {
      id: 1,
      batchNo: 'RB-20260626-01',
      beanName: '埃塞俄比亚 古吉 水洗',
      roastLevel: '浅中烘',
      scheduledAt: '09:30',
      status: '进行中',
      operator: '林舟',
    },
    {
      id: 2,
      batchNo: 'RB-20260626-02',
      beanName: '哥伦比亚 薇拉 厌氧',
      roastLevel: '中烘',
      scheduledAt: '11:00',
      status: '待烘焙',
      operator: '陈岚',
    },
    {
      id: 3,
      batchNo: 'RB-20260626-03',
      beanName: '巴西 喜拉多 日晒',
      roastLevel: '中深烘',
      scheduledAt: '14:20',
      status: '待烘焙',
      operator: '林舟',
    },
  ],
  inventoryAlerts: [
    {
      id: 1,
      beanName: '危地马拉 安提瓜 SHB',
      currentKg: 42,
      safetyKg: 60,
      level: 'warning',
    },
    {
      id: 2,
      beanName: '肯尼亚 AA Top',
      currentKg: 18,
      safetyKg: 50,
      level: 'critical',
    },
  ],
};

