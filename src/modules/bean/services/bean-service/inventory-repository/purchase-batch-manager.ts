import type { PocketBaseRestClient } from '@/shared/services/pocketBaseRestClient';
import { AppError } from '@/shared/errors/AppError';

import { normalizeRemainingWeightGrams } from '../bean.service.shared';
import { getLatestPurchaseBatchRecord } from '../bean.service.shared';
import { withOptionalCollectionFallback } from '../bean.service.inventory-repository.utils';
import type {
  EditablePurchaseBatchInput,
  RemotePurchaseBatchRecord,
} from '../bean.service.types';

export function createPurchaseBatchManager(
  client: Pick<PocketBaseRestClient, 'insert' | 'list' | 'update'>,
) {
  const toFiniteInteger = (value: unknown, fallback = 0): number => {
    const normalizedValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.round(normalizedValue);
  };

  const toNonNegativeInteger = (value: unknown, fallback = 0): number => {
    return Math.max(0, toFiniteInteger(value, fallback));
  };

  return {
    upsertLatestPurchaseBatch: async (
      beanId: string | number,
      input: {
        purchaseDate: string;
        purchasedTotalPrice: number;
        purchasedWeightGrams: number;
        remainingWeightGrams?: null | number;
        supplierName?: null | string;
      },
    ): Promise<void> => {
      const normalizedRemainingWeight = input.remainingWeightGrams ?? input.purchasedWeightGrams;

      const payload: EditablePurchaseBatchInput = {
        purchase_date: input.purchaseDate,
        purchased_total_price: input.purchasedTotalPrice,
        purchased_weight_grams: input.purchasedWeightGrams,
        remaining_weight_grams: normalizeRemainingWeightGrams({
          purchasedWeightGrams: input.purchasedWeightGrams,
          remainingWeightGrams: normalizedRemainingWeight,
        }),
        supplier_name: input.supplierName?.trim() || null,
      };

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const latestBatchRows = await client.list<RemotePurchaseBatchRecord>('green_bean_purchase_batches', {
          match: { green_bean_id: beanId },
        });
        const latestBatch = getLatestPurchaseBatchRecord(latestBatchRows);

        if (!latestBatch) {
          await client.insert('green_bean_purchase_batches', {
            green_bean_id: beanId,
            purchased_total_price: payload.purchased_total_price,
            purchased_weight_grams: payload.purchased_weight_grams,
            received_at: payload.purchase_date,
            remaining_weight_grams: payload.remaining_weight_grams,
            supplier_name: payload.supplier_name ?? null,
          });
          return;
        }

        try {
          await client.update(
            'green_bean_purchase_batches',
            {
              __expected_updated_at: latestBatch.updated_at ?? '',
              ...payload,
              remaining_weight_grams: payload.remaining_weight_grams,
            },
            {
              match: { id: latestBatch.id },
              select: '*',
            },
          );
          return;
        } catch (error) {
          if (!(error instanceof AppError) || error.status !== 409 || attempt === 2) {
            throw error;
          }
        }
      }
    },

    adjustRemainingWeight: async (
      beanId: string | number,
      deltaGrams: number,
    ): Promise<void> => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const purchaseRows = await client.list<RemotePurchaseBatchRecord>('green_bean_purchase_batches', {
          match: { green_bean_id: beanId },
        });
        const latestBatch = getLatestPurchaseBatchRecord(purchaseRows);

        if (!latestBatch) {
          throw new AppError('当前生豆缺少采购批次，无法更新剩余库存。', { code: 'DATA' });
        }

        const normalizedPurchasedWeightGrams = toNonNegativeInteger(latestBatch.purchased_weight_grams, 0);
        const normalizedCurrentRemainingWeight = toNonNegativeInteger(
          latestBatch.remaining_weight_grams,
          normalizedPurchasedWeightGrams,
        );
        const normalizedDeltaGrams = toFiniteInteger(deltaGrams, 0);
        const nextRemainingWeight = normalizedCurrentRemainingWeight - normalizedDeltaGrams;

        if (nextRemainingWeight < 0) {
          throw new AppError('剩余库存不足，无法记录本次烘焙。', { code: 'DATA' });
        }

        try {
          await client.update(
            'green_bean_purchase_batches',
            {
              __expected_updated_at: latestBatch.updated_at ?? '',
              remaining_weight_grams: Math.min(nextRemainingWeight, normalizedPurchasedWeightGrams),
            },
            {
              match: { id: latestBatch.id },
              select: '*',
            },
          );
          return;
        } catch (error) {
          if (!(error instanceof AppError) || error.status !== 409 || attempt === 2) {
            throw error;
          }
        }
      }

      throw new AppError('库存更新冲突，请刷新后重试。', { code: 'DATA' });
    },
  };
}
