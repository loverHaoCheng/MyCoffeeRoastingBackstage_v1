import { useMemo } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { useRoastBatches } from '@/modules/roast/hooks';

import { calculateFinanceOverview, resolveFinanceDateRange } from '../services';
import type { FinanceDateRange, FinanceRangePreset } from '../types';
import { useCostCalculations } from './useCostCalculations';
import { useFinanceExpenseRecords } from './useFinanceLedger';

export function useFinanceOverview(preset: FinanceRangePreset, customRange: FinanceDateRange | null) {
  const { data: beans = [], isFetching: isBeansFetching } = useBeans();
  const { data: calculations = [], isFetching: isCalculationsFetching } = useCostCalculations();
  const { data: expenseRecords = [], isFetching: isExpenseFetching } = useFinanceExpenseRecords();
  const { data: roastBatches = [], isFetching: isRoastBatchesFetching } = useRoastBatches();

  const range = useMemo(() => resolveFinanceDateRange(preset, customRange), [customRange, preset]);
  const overview = useMemo(() => {
    return calculateFinanceOverview({
      beans,
      calculations,
      expenseRecords,
      roastBatches,
      range,
    });
  }, [beans, calculations, expenseRecords, range, roastBatches]);

  return {
    beans,
    calculations,
    expenseRecords,
    roastBatches,
    isFetching: isBeansFetching || isCalculationsFetching || isExpenseFetching || isRoastBatchesFetching,
    overview,
    range,
  };
}
