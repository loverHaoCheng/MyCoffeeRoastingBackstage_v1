export type FinanceRangePreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export type FinanceExpenseStatus = 'paid' | 'pending';

export type FinanceIncomeStatus = 'received' | 'pending';

export type FinanceIncomeChannel = 'retail' | 'wholesale' | 'other';

export type FinanceExpenseCategory =
  | 'beanPurchase'
  | 'packaging'
  | 'shipping'
  | 'custom'
  | 'depreciation'
  | 'other';

export type FinanceExpenseSource = 'auto-bean-purchase' | 'manual';

export type FinanceIncomeSource = 'manual';

export interface FinanceDateRange {
  endDate: string;
  startDate: string;
}

export interface FinanceExpenseFormInput {
  amount: number;
  category: FinanceExpenseCategory;
  customCategoryLabel?: null | string;
  expenseDate: string;
  notes?: null | string;
  roastBatchIds?: string[];
  status: FinanceExpenseStatus;
  title: string;
}

export interface FinanceExpenseRecord extends FinanceExpenseFormInput {
  createdAt: string;
  id: string;
  source?: FinanceExpenseSource;
  sourceEntityId?: null | string;
  updatedAt: string;
}

export interface FinanceIncomeFormInput {
  amount: number;
  channel: FinanceIncomeChannel;
  incomeDate: string;
  notes?: null | string;
  status: FinanceIncomeStatus;
  title: string;
}

export interface FinanceIncomeRecord extends FinanceIncomeFormInput {
  createdAt: string;
  id: string;
  source?: FinanceIncomeSource;
  sourceEntityId?: null | string;
  updatedAt: string;
}

export interface FinanceOverviewMetrics {
  estimatedBeanCost: number;
  estimatedProfit: number;
  estimatedRevenue: number;
  expenseRecordCount: number;
  grossProfit: number;
  incomeRecordCount: number;
  operatingProfit: number;
  realizedIncome: number;
  realizedProfit: number;
  realizedBeanCost: number;
  totalExpenses: number;
}

export type FinanceOverviewDrilldownKey =
  | 'estimatedBeanCost'
  | 'estimatedProfit'
  | 'estimatedRevenue'
  | 'realizedBeanCost'
  | 'realizedIncome'
  | 'realizedProfit'
  | 'totalExpenses';

export interface FinanceOverviewDetailItem {
  amount: number;
  categoryLabel: string;
  date: string;
  deleteHint?: string;
  deletable?: boolean;
  id: string;
  notes: null | string;
  sourceEntityId?: null | string;
  sourceType?: 'autoBeanPurchase' | 'estimatedRevenue' | 'manualExpense' | 'manualIncome' | 'roastBatchRevenue';
  sourceLabel: string;
  title: string;
}

export interface FinanceOverviewDrilldownPayload {
  emptyText: string;
  key: FinanceOverviewDrilldownKey;
  records: FinanceOverviewDetailItem[];
  title: string;
  total: number;
}

export interface RoastBatchRevenueDetail {
  amount: number;
  beanCost: number;
  date: string;
  id: string;
  notes: null | string;
  saleUnitCount: number;
  saleUnitPrice: number;
  shippingCost: number;
  title: string;
}
