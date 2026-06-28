export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  trend: string;
  tone: 'green' | 'blue' | 'amber' | 'red';
}

export interface RoastTask {
  id: number;
  batchNo: string;
  beanName: string;
  roastLevel: string;
  scheduledAt: string;
  status: '待烘焙' | '进行中' | '待冷却' | '已完成';
  operator: string;
}

export interface InventoryAlert {
  id: number;
  beanName: string;
  currentKg: number;
  safetyKg: number;
  level: 'warning' | 'critical';
}

export interface DashboardOverview {
  metrics: DashboardMetric[];
  roastTasks: RoastTask[];
  inventoryAlerts: InventoryAlert[];
}

