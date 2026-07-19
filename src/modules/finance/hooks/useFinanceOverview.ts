import { useMemo } from 'react';

import { useBeans } from '@/modules/bean/hooks';
import { useRoastBatches } from '@/modules/roast/hooks';
import { useCostTemplateSettings } from '@/modules/settings/hooks';

import { calculateFinanceOverview, resolveFinanceDateRange } from '../services';
import type { FinanceDateRange, FinanceRangePreset } from '../types';
import { useCostCalculations } from './useCostCalculations';
import { useFinanceExpenseRecords, useFinanceIncomeRecords } from './useFinanceLedger';

export function useFinanceOverview(
  preset: FinanceRangePreset,
  customRange: FinanceDateRange | null,
) {
  const { data: beans = [], isFetching: isBeansFetching } = useBeans();
  const { data: calculations = [], isFetching: isCalculationsFetching } = useCostCalculations();
  const { data: expenseRecords = [], isFetching: isExpenseFetching } = useFinanceExpenseRecords();
  const { data: incomeRecords = [], isFetching: isIncomeFetching } = useFinanceIncomeRecords();
  const { data: roastBatches = [], isFetching: isRoastBatchesFetching } = useRoastBatches();
  const { costTemplateSettings } = useCostTemplateSettings();

  const range = useMemo(() => resolveFinanceDateRange(preset, customRange), [customRange, preset]);
  const overview = useMemo(() => {
    return calculateFinanceOverview({
      beans,
      calculations,
      expenseRecords,
      incomeRecords,
      roastBatches,
      range,
      templates: costTemplateSettings.templates,
    });
  }, [beans, calculations, costTemplateSettings.templates, expenseRecords, incomeRecords, range, roastBatches]);

  return {
    beans,
    calculations,
    expenseRecords,
    incomeRecords,
    roastBatches,
    isFetching: isBeansFetching || isCalculationsFetching || isExpenseFetching || isIncomeFetching || isRoastBatchesFetching,
    overview,
    range,
    templates: costTemplateSettings.templates,
  };
}
