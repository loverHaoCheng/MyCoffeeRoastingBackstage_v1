export type FinanceRangePreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export type FinanceExpenseStatus = 'paid' | 'pending';

export type FinanceExpenseCategory =
  | 'beanPurchase'
  | 'packaging'
  | 'shipping'
  | 'custom'
  | 'depreciation'
  | 'other';

export type FinanceExpenseSource = 'auto-bean-purchase' | 'manual';

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

export interface FinanceOverviewMetrics {
  estimatedRevenue: number;
  expenseRecordCount: number;
  grossProfit: number;
  incomeRecordCount: number;
  operatingProfit: number;
  realizedIncome: number;
  totalExpenses: number;
}

export type FinanceOverviewDrilldownKey = 'estimatedRevenue' | 'realizedIncome' | 'totalExpenses';

export interface FinanceOverviewDetailItem {
  amount: number;
  categoryLabel: string;
  date: string;
  deleteHint?: string;
  deletable?: boolean;
  id: string;
  notes: null | string;
  sourceEntityId?: null | string;
  sourceType?: 'autoBeanPurchase' | 'estimatedRevenue' | 'manualExpense' | 'roastBatchRevenue';
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
  date: string;
  id: string;
  notes: null | string;
  saleUnitCount: number;
  saleUnitPrice: number;
  title: string;
}
