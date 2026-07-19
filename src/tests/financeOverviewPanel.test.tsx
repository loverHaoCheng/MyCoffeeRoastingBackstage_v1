import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FinanceOverviewPanel } from '@/modules/finance/components/FinanceOverviewPanel';
import type { FinanceOverviewMetrics } from '@/modules/finance/types';

const overview: FinanceOverviewMetrics = {
  estimatedBeanCost: 120,
  estimatedProfit: 160,
  estimatedRevenue: 280,
  expenseRecordCount: 2,
  grossProfit: 100,
  incomeRecordCount: 1,
  operatingProfit: 80,
  realizedBeanCost: 48,
  realizedIncome: 140,
  realizedProfit: 92,
  totalExpenses: 60,
};

describe('FinanceOverviewPanel', () => {
  it('opens the matching drawer for every overview row', () => {
    const onDrilldown = vi.fn();

    render(<FinanceOverviewPanel overview={overview} onDrilldown={onDrilldown} />);

    fireEvent.click(screen.getByRole('button', { name: '查看库存预估成本明细' }));
    fireEvent.click(screen.getByRole('button', { name: '查看已售出生豆成本明细' }));
    fireEvent.click(screen.getByRole('button', { name: '查看已实现利润明细' }));
    fireEvent.click(screen.getByRole('button', { name: '查看库存预估利润明细' }));

    expect(onDrilldown.mock.calls).toEqual([
      ['estimatedBeanCost'],
      ['realizedBeanCost'],
      ['realizedProfit'],
      ['estimatedProfit'],
    ]);
  });
});
