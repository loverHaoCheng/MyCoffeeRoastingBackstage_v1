import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useBeans } from '@/modules/bean/hooks/useBeans';
import { roastBatchQueryKeys, useRoastBatches } from '@/modules/roast/hooks';
import { roastBatchService } from '@/modules/roast/services/roastBatch.service';
import { costTemplateSyncService } from '@/modules/settings/services/costTemplateSync.service';
import { useCostTemplateSettings } from '@/modules/settings/hooks';

import {
  buildCostTemplateById,
  buildHistoricalSaleSnapshotUpdate,
  calculateFinanceOverview,
  resolveFinanceDateRange,
} from '../services';
import { logger } from '@/shared/logger/logger';
import type { FinanceDateRange, FinanceRangePreset } from '../types';
import { useCostCalculations } from './useCostCalculations';
import { useFinanceExpenseRecords, useFinanceIncomeRecords } from './useFinanceLedger';

export function useFinanceOverview(
  preset: FinanceRangePreset,
  customRange: FinanceDateRange | null,
) {
  const queryClient = useQueryClient();
  const snapshotAttemptedBatchIds = useRef(new Set<string>());
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
  const defaultTemplateId = remoteCostTemplateSettings?.defaultTemplateId ?? costTemplateSettings.defaultTemplateId;

  useEffect(() => {
    if (isBeansFetching || isRoastBatchesFetching || isCostTemplateSettingsFetching) {
      return;
    }

    const beansById = new Map(beans.map((bean) => [String(bean.id), bean]));
    const beansByName = new Map(beans.map((bean) => [bean.name.trim(), bean]));
    const templatesById = buildCostTemplateById(templates);
    const pendingUpdates = roastBatches.flatMap((batch) => {
      if (snapshotAttemptedBatchIds.current.has(batch.id)) {
        return [];
      }

      const update = buildHistoricalSaleSnapshotUpdate(
        batch,
        beansById.get(batch.greenBeanId) ?? beansByName.get(batch.greenBeanName.trim()),
        templatesById,
        calculations
          .filter((calculation) => calculation.beanId === batch.greenBeanId)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0],
        defaultTemplateId ? templatesById.get(defaultTemplateId) : undefined,
      );

      return update ? [{ batchId: batch.id, input: update }] : [];
    });

    if (pendingUpdates.length === 0) {
      return;
    }

    const persistSnapshots = async () => {
      let hasPersistedSnapshot = false;

      for (const update of pendingUpdates) {
        snapshotAttemptedBatchIds.current.add(update.batchId);

        try {
          await roastBatchService.updateBatch(update.batchId, update.input);
          hasPersistedSnapshot = true;
        } catch (error: unknown) {
          logger.warn('historical sale snapshot backfill failed', {
            batchId: update.batchId,
            error,
          });
        }
      }

      if (hasPersistedSnapshot) {
        await queryClient.invalidateQueries({ queryKey: roastBatchQueryKeys.list() });
      }
    };

    void persistSnapshots();
  }, [
    beans,
    calculations,
    isBeansFetching,
    isCostTemplateSettingsFetching,
    isRoastBatchesFetching,
    defaultTemplateId,
    queryClient,
    roastBatches,
    templates,
  ]);

  const range = useMemo(() => resolveFinanceDateRange(preset, customRange), [customRange, preset]);
  const overview = useMemo(() => {
    return calculateFinanceOverview({
      beans,
      calculations,
      defaultTemplateId,
      expenseRecords,
      incomeRecords,
      roastBatches,
      range,
      templates,
    });
  }, [beans, calculations, defaultTemplateId, expenseRecords, incomeRecords, range, roastBatches, templates]);

  return {
    beans,
    calculations,
    defaultTemplateId,
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
