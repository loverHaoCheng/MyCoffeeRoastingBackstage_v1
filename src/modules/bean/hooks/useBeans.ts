import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { beanEditableDetailQueryKeys } from '@/modules/bean/hooks/useBeanEditableDetail';
import { beanService } from '@/modules/bean/services';
import { normalizeFlavorTags } from '@/modules/bean/utils/flavorTags';
import { AppError } from '@/shared/errors/AppError';
import type { GreenBeanEditableDetail, GreenBeanUpdateInput } from '@/modules/bean/types';
import type { Bean } from '@/types/domain';

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
    mutationFn: async (beanId: Bean['id']) => {
      return beanService.deleteBean(beanId);
    },
    onMutate: async (beanId) => {
      await queryClient.cancelQueries({ queryKey: beanQueryKeys.list() });
      await queryClient.cancelQueries({ queryKey: beanEditableDetailQueryKeys.detail(beanId) });

      const previousBeans = queryClient.getQueryData<Bean[]>(beanQueryKeys.list());
      const previousDetail = queryClient.getQueryData<GreenBeanEditableDetail>(
        beanEditableDetailQueryKeys.detail(beanId),
      );
      const removedBean = previousBeans?.find((bean) => String(bean.id) === String(beanId)) ?? null;
      const deleteSnapshot = beanService.prepareOptimisticDelete(beanId);

      queryClient.setQueryData<Bean[]>(
        beanQueryKeys.list(),
        (current = []) => current.filter((bean) => String(bean.id) !== String(beanId)),
      );

      return {
        previousBeans,
        previousDetail,
        deleteSnapshot,
        removedBean,
      };
    },
    onError: (_error, beanId, context) => {
      if (context?.previousBeans) {
        queryClient.setQueryData(beanQueryKeys.list(), context.previousBeans);
      }

      if (context?.previousDetail) {
        queryClient.setQueryData(beanEditableDetailQueryKeys.detail(beanId), context.previousDetail);
      }

      if (context?.deleteSnapshot) {
        beanService.rollbackOptimisticDelete(context.deleteSnapshot);
      }
    },
    onSuccess: (result, beanId) => {
      if (result.synced) {
        queryClient.removeQueries({ queryKey: beanEditableDetailQueryKeys.detail(beanId), exact: true });
        void queryClient.invalidateQueries({ queryKey: beanQueryKeys.list() });
      }
    },
  });
}
