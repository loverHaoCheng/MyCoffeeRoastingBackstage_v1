import { ModuleComingSoonPage } from '@/shared/components/ModuleComingSoonPage';

export function InventoryPage() {
  return (
    <ModuleComingSoonPage
      actions={[{ label: '库存调整', primary: true }, { label: '预警规则' }]}
      focusItems={['库位余量', '安全库存阈值', '批次锁定库存', '出入库流水']}
      stats={[
        { label: '总库存', value: '1,260 kg', tone: 'green' },
        { label: '已预留', value: '186 kg', tone: 'blue' },
        { label: '待入库', value: '320 kg', tone: 'amber' },
        { label: '预警项', value: '2', tone: 'red' },
      ]}
      subtitle="统一生豆、熟豆和包装物库存视图，支撑排产、成本和供应链分析。"
      title="库存管理"
    />
  );
}

