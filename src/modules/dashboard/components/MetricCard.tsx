import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

import type { DashboardMetric } from '@/modules/dashboard/types';

import styles from './MetricCard.module.css';

interface MetricCardProps {
  metric: DashboardMetric;
}

export function MetricCard({ metric }: MetricCardProps) {
  const isPositive = !metric.trend.includes('-');

  return (
    <article className={styles.card} data-tone={metric.tone}>
      <span className={styles.label}>{metric.label}</span>
      <strong className={styles.value}>{metric.value}</strong>
      <span className={styles.trend} data-positive={isPositive}>
        {isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        {metric.trend}
      </span>
    </article>
  );
}

