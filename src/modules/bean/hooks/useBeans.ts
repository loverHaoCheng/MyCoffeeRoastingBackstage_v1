import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { beanEditableDetailQueryKeys } from '@/modules/bean/hooks/useBeanEditableDetail';
import { beanService } from '@/modules/bean/services';
import { normalizeFlavorTags } from '@/modules/bean/utils/flavorTags';
import { roastBatchQueryKeys } from '@/modules/roast/hooks/useRoastBatches';
import { roastPlanQueryKeys } from '@/modules/roast/hooks/useRoastPlans';
import { syncDeletedBeanBatches, syncDeletedBeanPlans } from '@/modules/roast/utils/roastCacheSync';
import { AppError } from '@/shared/errors/AppError';
import type { GreenBeanEditableDetail, GreenBeanUpdateInput } from '@/modules/bean/types';
import type { RoastPlanDisposition } from '@/modules/bean/services/bean.service';
import type { Bean } from '@/types/domain';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import type { RoastPlan } from '@/types/domain';

export const beanQueryKeys = {
  all: ['beans'] as const,
  list: () => [...beanQueryKeys.all, 'list'] as const,
};

const normalizeText = (value: null | string | undefined): null | string => {
  const trimmed = value?.trim() ?? '';

  return trimmed.length > 0 ? trimmed : null;
};

const buildOriginLabel = (input: GreenBeanUpdateInput): string => {
  return [input.originCountry, input.originRegion, input.originArea]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' · ');
};

const buildOptimisticBean = (currentBean: Bean, input: GreenBeanUpdateInput): Bean => {
  const remainingWeightGrams = Math.max(0, Math.round(input.remainingWeightGrams));
  const purchasedWeightGrams = Math.max(0, Math.round(input.purchasedWeightGrams));

  return {
    agingDays: input.agingDays,
    ...currentBean,
    code: input.code.trim(),
    costPerKg:
      purchasedWeightGrams > 0
        ? Number(((input.purchasedTotalPrice / purchasedWeightGrams) * 1000).toFixed(2))
        : 0,
    createdAt: currentBean.createdAt,
    costTemplateId: input.costTemplateId ?? null,
    defaultRoastInputGrams: input.defaultRoastInputGrams,
    defaultSaleUnitPrice: input.defaultSaleUnitPrice,
    defaultSaleUnitWeightGrams: input.defaultSaleUnitWeightGrams ?? null,
    flavorTags: normalizeFlavorTags(input.flavorTags),
    grade: normalizeText(input.grade) ?? '',
    harvestSeason: normalizeText(input.harvestSeason) ?? undefined,
    id: currentBean.id,
    name: input.displayName.trim(),
    origin: buildOriginLabel(input),
    process: input.processMethod.trim(),
    purchaseDate: input.purchaseDate,
    purchasedTotalPrice: input.purchasedTotalPrice,
    purchasedWeightGrams,
    remainingWeightGrams,
    stockKg: Number((remainingWeightGrams / 1000).toFixed(1)),
    supplierName: normalizeText(input.supplierName),
    tastingEndDays: input.tastingEndDays,
    updatedAt: new Date().toISOString(),
    variety: input.variety.trim(),
  };
};

const buildOptimisticEditableDetail = (
  currentDetail: GreenBeanEditableDetail | undefined,
  currentBean: Bean,
  input: GreenBeanUpdateInput,
): GreenBeanEditableDetail => {
  return {
    beanId: currentDetail?.beanId ?? String(currentBean.id),
    agingDays: input.agingDays,
    costTemplateId: input.costTemplateId ?? currentDetail?.costTemplateId ?? null,
    code: input.code.trim(),
    defaultRoastInputGrams: input.defaultRoastInputGrams,
    defaultSaleSpecId: currentDetail?.defaultSaleSpecId ?? null,
    defaultSaleUnitPrice: input.defaultSaleUnitPrice,
    defaultSaleUnitWeightGrams: input.defaultSaleUnitWeightGrams ?? null,
    displayName: input.displayName.trim(),
    flavorTags: normalizeFlavorTags(input.flavorTags),
    grade: normalizeText(input.grade),
    harvestSeason: normalizeText(input.harvestSeason),
    millName: normalizeText(input.millName),
    notes: normalizeText(input.notes),
    originArea: normalizeText(input.originArea),
    originCountry: normalizeText(input.originCountry) ?? '',
    originRegion: normalizeText(input.originRegion),
    processMethod: input.processMethod.trim(),
    purchaseDate: input.purchaseDate,
    purchaseBatchId: currentDetail?.purchaseBatchId ?? null,
    purchasedTotalPrice: input.purchasedTotalPrice,
    purchasedWeightGrams: input.purchasedWeightGrams,
    remainingWeightGrams: input.remainingWeightGrams,
    supplierName: normalizeText(input.supplierName),
    tastingEndDays: input.tastingEndDays,
    variety: input.variety.trim(),
    altitudeMetersMax: input.altitudeMetersMax ?? null,
    altitudeMetersMin: input.altitudeMetersMin ?? null,
    densityGPerL: input.densityGPerL ?? null,
    moisturePercent: input.moisturePercent ?? null,
  };
};

export function useBeans() {
  const initialBeans = beanService.getBootstrappedBeans();

  return useQuery({
    initialData: initialBeans.length > 0 ? initialBeans : undefined,
    queryKey: beanQueryKeys.list(),
    queryFn: async () => {
      const response = await beanService.listBeans();

      return response.data;
    },
    retry: (failureCount, error) => {
      if (error instanceof AppError) {
        if (error.code === 'AUTH' || error.code === 'CONFIG' || error.code === 'DATA') {
          return false;
        }
      }

      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

export function useUpdateBean() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { beanId: Bean['id']; input: GreenBeanUpdateInput }) => {
      const response = await beanService.updateBean(variables.beanId, variables.input);

      return response.data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: beanQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: beanEditableDetailQueryKeys.detail(variables.beanId) });

      const previousBeans = queryClient.getQueryData<Bean[]>(beanQueryKeys.list());
      const previousDetail = queryClient.getQueryData<GreenBeanEditableDetail>(
        beanEditableDetailQueryKeys.detail(variables.beanId),
      );
      const currentBean = previousBeans?.find((bean) => String(bean.id) === String(variables.beanId));

      if (currentBean) {
        const nextBean = buildOptimisticBean(currentBean, variables.input);
        queryClient.setQueryData<Bean[]>(
          beanQueryKeys.list(),
          (current = []) => current.map((bean) => (String(bean.id) === String(variables.beanId) ? nextBean : bean)),
        );
        queryClient.setQueryData<GreenBeanEditableDetail>(
          beanEditableDetailQueryKeys.detail(variables.beanId),
          buildOptimisticEditableDetail(previousDetail, currentBean, variables.input),
        );
      }

      return { previousBeans, previousDetail };
    },
    onError: (_error, variables, context) => {
      if (context?.previousBeans) {
        queryClient.setQueryData(beanQueryKeys.list(), context.previousBeans);
      }

      if (context?.previousDetail) {
        queryClient.setQueryData(
          beanEditableDetailQueryKeys.detail(variables.beanId),
          context.previousDetail,
        );
      }
    },
    onSuccess: (nextBean, variables) => {
      queryClient.setQueryData<Bean[]>(
        beanQueryKeys.list(),
        (current = []) => current.map((bean) => (String(bean.id) === String(variables.beanId) ? nextBean : bean)),
      );
      queryClient.setQueryData<GreenBeanEditableDetail>(
        beanEditableDetailQueryKeys.detail(variables.beanId),
        (currentDetail) => {
          const currentBean = queryClient
            .getQueryData<Bean[]>(beanQueryKeys.list())
            ?.find((bean) => String(bean.id) === String(variables.beanId));

          if (!currentBean) {
            return currentDetail;
          }

          return buildOptimisticEditableDetail(currentDetail, currentBean, variables.input);
        },
      );
    },
  });
}

export function useDeleteBean() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { beanId: Bean['id']; roastPlanDisposition: RoastPlanDisposition }) => {
      return beanService.deleteBean(variables.beanId, variables.roastPlanDisposition);
    },
    onMutate: async (variables) => {
      const { beanId } = variables;
      await queryClient.cancelQueries({ queryKey: beanQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: beanEditableDetailQueryKeys.detail(beanId) });
      await queryClient.cancelQueries({ queryKey: roastPlanQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: roastBatchQueryKeys.list() });

      const previousBeans = queryClient.getQueryData<Bean[]>(beanQueryKeys.list());
      const previousDetail = queryClient.getQueryData<GreenBeanEditableDetail>(
        beanEditableDetailQueryKeys.detail(beanId),
      );
      const previousPlans = queryClient.getQueryData<RoastPlan[]>(roastPlanQueryKeys.list());
      const previousBatches = queryClient.getQueryData<RoastBatchRecord[]>(roastBatchQueryKeys.list());
      const removedBean = previousBeans?.find((bean) => String(bean.id) === String(beanId)) ?? null;
      const deleteSnapshot = beanService.prepareOptimisticDelete(beanId);

      queryClient.setQueryData<Bean[]>(
        beanQueryKeys.list(),
        (current = []) => current.filter((bean) => String(bean.id) !== String(beanId)),
      );
      queryClient.setQueryData<RoastPlan[]>(
        roastPlanQueryKeys.list(),
        (current = []) => syncDeletedBeanPlans(current, beanId, variables.roastPlanDisposition),
      );
      queryClient.setQueryData<RoastBatchRecord[]>(
        roastBatchQueryKeys.list(),
        (current = []) => syncDeletedBeanBatches(current, beanId),
      );

      return {
        previousBatches,
        previousBeans,
        previousDetail,
        previousPlans,
        deleteSnapshot,
        removedBean,
      };
    },
    onError: (_error, variables, context) => {
      const { beanId } = variables;
      if (context?.previousBeans) {
        queryClient.setQueryData(beanQueryKeys.list(), context.previousBeans);
      }

      if (context?.previousDetail) {
        queryClient.setQueryData(beanEditableDetailQueryKeys.detail(beanId), context.previousDetail);
      }
      if (context?.previousPlans) {
        queryClient.setQueryData(roastPlanQueryKeys.list(), context.previousPlans);
      }
      if (context?.previousBatches) {
        queryClient.setQueryData(roastBatchQueryKeys.list(), context.previousBatches);
      }

      if (context?.deleteSnapshot) {
        beanService.rollbackOptimisticDelete(context.deleteSnapshot);
      }
    },
    onSuccess: (result, variables) => {
      const { beanId } = variables;
      if (result.synced) {
        queryClient.removeQueries({ queryKey: beanEditableDetailQueryKeys.detail(beanId), exact: true });
        void queryClient.invalidateQueries({ queryKey: beanQueryKeys.list() });
        void queryClient.invalidateQueries({ queryKey: roastPlanQueryKeys.list() });
        void queryClient.invalidateQueries({ queryKey: roastBatchQueryKeys.list() });
      }
    },
  });
}
