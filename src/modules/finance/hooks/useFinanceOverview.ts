import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useBeans } from '@/modules/bean/hooks/useBeans';
import { useRoastBatches } from '@/modules/roast/hooks';
import { costTemplateSyncService } from '@/modules/settings/services/costTemplateSync.service';
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
  const {
    data: remoteCostTemplateSettings,
    isFetching: isCostTemplateSettingsFetching,
  } = useQuery({
    queryKey: ['settings', 'cost-templates', 'finance'],
    queryFn: () => costTemplateSyncService.syncFromRemote(),
    staleTime: 60_000,
  });
  const templates = remoteCostTemplateSettings?.templates ?? costTemplateSettings.templates;

  const range = useMemo(() => resolveFinanceDateRange(preset, customRange), [customRange, preset]);
  const overview = useMemo(() => {
    return calculateFinanceOverview({
      beans,
      calculations,
      expenseRecords,
      incomeRecords,
      roastBatches,
      range,
      templates,
    });
  }, [beans, calculations, expenseRecords, incomeRecords, range, roastBatches, templates]);

  return {
    beans,
    calculations,
    expenseRecords,
    incomeRecords,
    roastBatches,
    isFetching:
      isBeansFetching ||
      isCalculationsFetching ||
      isExpenseFetching ||
      isIncomeFetching ||
      isRoastBatchesFetching ||
      isCostTemplateSettingsFetching,
    overview,
    range,
    templates,
  };
}
