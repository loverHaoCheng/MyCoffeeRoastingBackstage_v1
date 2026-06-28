import { BellOutlined, CalendarOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Skeleton, Space } from 'antd';

import { InventoryAlertList } from '@/modules/dashboard/components/InventoryAlertList';
import { MetricCard } from '@/modules/dashboard/components/MetricCard';
import { RoastTaskTable } from '@/modules/dashboard/components/RoastTaskTable';
import { useDashboardOverview } from '@/modules/dashboard/hooks/useDashboardOverview';

import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const { data, isError, isLoading, refetch } = useDashboardOverview();

  if (isLoading) {
    return (
      <main className={styles.page}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className={styles.page}>
        <Alert
          action={
            <Button icon={<ReloadOutlined />} onClick={() => void refetch()} size="small">
              重试
            </Button>
          }
          message="工作台数据暂时不可用"
          showIcon
          type="error"
        />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>今日烘焙 · 2026-06-26</span>
          <h1>咖啡烘焙工作台</h1>
          <p>排产、库存、批次与成本集中查看，适合手机巡检和平板现场操作。</p>
        </div>
        <Space className={styles.heroActions} wrap>
          <Button icon={<CalendarOutlined />}>查看排产</Button>
          <Button icon={<PlusOutlined />} type="primary">
            新建烘焙计划
          </Button>
        </Space>
      </section>

      <section className={styles.metricGrid} aria-label="核心指标">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </section>

      <section className={styles.workspaceGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Roast Queue</span>
              <h2>近期烘焙任务</h2>
            </div>
            <Button icon={<BellOutlined />} type="text">
              批次提醒
            </Button>
          </div>
          <RoastTaskTable tasks={data.roastTasks} />
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Inventory</span>
              <h2>库存预警</h2>
            </div>
          </div>
          <InventoryAlertList alerts={data.inventoryAlerts} />
        </article>
      </section>
    </main>
  );
}

