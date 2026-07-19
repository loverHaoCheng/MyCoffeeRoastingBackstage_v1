import RightOutlined from "@ant-design/icons/RightOutlined";

import type { FinanceOverviewDrilldownKey, FinanceOverviewMetrics } from '@/modules/finance/types';

import styles from './FinanceOverviewPanel.module.css';

interface FinanceOverviewPanelProps {
  onDrilldown?: (key: FinanceOverviewDrilldownKey) => void;
  overview: FinanceOverviewMetrics;
}

const formatCurrency = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const buildRows = (overview: FinanceOverviewMetrics) => [
  {
    drilldownKey: 'estimatedBeanCost' as const,
    key: 'estimatedBeanCost',
    label: '库存预估成本',
    value: `¥${formatCurrency.format(overview.estimatedBeanCost)}`,
  },
  {
    drilldownKey: 'totalExpenses' as const,
    key: 'totalExpenses',
    label: '全部花费',
    value: `¥${formatCurrency.format(overview.totalExpenses)}`,
  },
  {
    drilldownKey: 'realizedIncome' as const,
    key: 'realizedIncome',
    label: '已实现收入',
    value: `¥${formatCurrency.format(overview.realizedIncome)}`,
  },
  {
    drilldownKey: 'realizedBeanCost' as const,
    key: 'realizedBeanCost',
    label: '已售出生豆成本',
    value: `¥${formatCurrency.format(overview.realizedBeanCost)}`,
  },
  {
    drilldownKey: 'realizedProfit' as const,
    key: 'realizedProfit',
    label: '已实现利润',
    value: `¥${formatCurrency.format(overview.realizedProfit)}`,
  },
  {
    drilldownKey: 'estimatedRevenue' as const,
    key: 'estimatedRevenue',
    label: '当前库存预估收入',
    value: `¥${formatCurrency.format(overview.estimatedRevenue)}`,
  },
  {
    drilldownKey: 'estimatedProfit' as const,
    key: 'estimatedProfit',
    label: '库存预估利润',
    value: `¥${formatCurrency.format(overview.estimatedProfit)}`,
  },
  {
    key: 'operatingProfit',
    label: '经营利润',
    value: `¥${formatCurrency.format(overview.operatingProfit)}`,
  },
];

export function FinanceOverviewPanel({
  onDrilldown,
  overview,
}: FinanceOverviewPanelProps) {
  return (
    <section aria-label="财务经营概览" className={styles.panel}>
      <div className={styles.rowList}>
        {buildRows(overview).map((row) => {
          const isInteractive = Boolean(row.drilldownKey && onDrilldown);

          return (
            <button
              aria-label={isInteractive ? `查看${row.label}明细` : undefined}
              className={styles.row}
              data-interactive={String(isInteractive)}
              disabled={!isInteractive}
              key={row.key}
              onClick={() => {
                if (row.drilldownKey && onDrilldown) {
                  onDrilldown(row.drilldownKey);
                }
              }}
              type="button"
            >
              <span className={styles.rowLabel}>{row.label}</span>
              <span className={styles.rowTail}>
                <strong className={styles.rowValue}>{row.value}</strong>
                {isInteractive ? (
                  <span aria-hidden="true" className={styles.rowArrow}>
                    <RightOutlined />
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
