import type { Bean } from '@/types/domain';
import type { CostTemplate } from '@/modules/settings/types';
import { buildCostTemplateById, calculateEstimatedBeanProfit } from '../financeProfitCalculation.service';
import { getFinanceDateTextFromTimestamp } from './dateUtils';
import { formatRevenueUnitCount, toMoney } from './formatUtils';
import { sortOverviewDetailRecords } from './sortUtils';
import type { FinanceOverviewDetailItem, FinanceOverviewDrilldownPayload } from '../../types';

export const buildInventoryDrilldown = (
  beans: Bean[],
  templates: CostTemplate[],
  key: 'estimatedBeanCost' | 'estimatedProfit' | 'estimatedRevenue',
): FinanceOverviewDrilldownPayload => {
  const templatesById = buildCostTemplateById(templates);
  const inventoryDrilldownConfig = {
    estimatedBeanCost: {
      getAmount: (metrics: NonNullable<ReturnType<typeof calculateEstimatedBeanProfit>>) => metrics.beanCost,
      title: '库存预估成本明细',
    },
    estimatedProfit: {
      getAmount: (metrics: NonNullable<ReturnType<typeof calculateEstimatedBeanProfit>>) => metrics.profit,
      title: '库存预估利润明细',
    },
    estimatedRevenue: {
      getAmount: (metrics: NonNullable<ReturnType<typeof calculateEstimatedBeanProfit>>) => metrics.revenue,
      title: '当前库存预估收入明细',
    },
  } as const;
  const config = inventoryDrilldownConfig[key];
  const records = sortOverviewDetailRecords(
    beans
      .map((bean) => {
        const metrics = calculateEstimatedBeanProfit(bean, templatesById);

        if (!metrics) {
          return null;
        }

        return {
          amount: config.getAmount(metrics),
          categoryLabel: `${formatRevenueUnitCount(metrics.saleUnitCount)} 份 · 可烘焙 ${String(metrics.plannedBatchCount)} 锅 · 成本 ¥${metrics.beanCost.toFixed(2)} · 利润 ¥${metrics.profit.toFixed(2)}`,
          date: getFinanceDateTextFromTimestamp(bean.updatedAt),
          deletable: false,
          id: `estimated-${String(bean.id)}`,
          notes: '按关联成本模板的生豆重量、脱水率和出售单份熟豆重量估算',
          sourceEntityId: String(bean.id),
          sourceType: 'estimatedRevenue' as const,
          sourceLabel: '当前库存估算',
          title: bean.name,
        };
      })
      .filter((record): record is NonNullable<typeof record> => record !== null && record.amount > 0),
  );

  return {
    emptyText: '当前还没有可用于估算的库存',
    key,
    records,
    title: config.title,
    total: toMoney(records.reduce((sum, record) => sum + record.amount, 0)),
  };
};
