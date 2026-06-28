import { ModuleComingSoonPage } from '@/shared/components/ModuleComingSoonPage';

export function FinancePage() {
  return (
    <ModuleComingSoonPage
      actions={[{ label: '成本核算', primary: true }, { label: '利润报表' }]}
      focusItems={['生豆采购成本', '烘焙能耗分摊', '人工与包装成本', '批次毛利分析']}
      stats={[
        { label: '均价', value: '58.4 元/kg', tone: 'green' },
        { label: '本周成本', value: '19,972', tone: 'blue' },
        { label: '能耗占比', value: '7.8%', tone: 'amber' },
        { label: '异常成本', value: '1', tone: 'red' },
      ]}
      subtitle="沉淀采购、生产、包装和销售成本，为利润分析和经营决策提供依据。"
      title="成本分析"
    />
  );
}

