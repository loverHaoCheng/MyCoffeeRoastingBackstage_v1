import type { PocketBaseRestClient } from '@/shared/services/pocketBaseRestClient';

import { getDefaultSaleSpecRecord } from '../bean.service.shared';
import { withOptionalCollectionFallback } from '../bean.service.inventory-repository.utils';
import type {
  RemoteRoastBatchOverviewRecord,
  RemoteSaleSpecRecord,
} from '../bean.service.types';

export function createCollectionLoader(
  client: Pick<PocketBaseRestClient, 'insert' | 'list' | 'update'>,
) {
  return {
    listSaleSpecs: (
      options?: Parameters<typeof client.list<RemoteSaleSpecRecord>>[1],
    ): Promise<RemoteSaleSpecRecord[]> => {
      return withOptionalCollectionFallback(
        'bean_sale_specs',
        'list bean sale specs',
        () => client.list<RemoteSaleSpecRecord>('bean_sale_specs', options),
        [],
      );
    },

    listRoastBatches: (): Promise<RemoteRoastBatchOverviewRecord[]> => {
      return withOptionalCollectionFallback(
        'roast_batches',
        'list roast batches for bean aggregation',
        () => client.list<RemoteRoastBatchOverviewRecord>('roast_batches'),
        [],
      );
    },

    upsertOptionalDefaultSaleSpec: async (
      beanId: string | number,
      input: {
        defaultSaleUnitPrice: number;
        defaultSaleUnitWeightGrams?: null | number | undefined;
      },
    ): Promise<void> => {
      await withOptionalCollectionFallback('bean_sale_specs', 'upsert default sale spec', async () => {
        const existingSaleSpecs = await client.list<RemoteSaleSpecRecord>('bean_sale_specs', {
          match: { green_bean_id: beanId, is_default: true },
        });
        const defaultSaleSpec = getDefaultSaleSpecRecord(existingSaleSpecs);

        if (input.defaultSaleUnitWeightGrams == null) {
          if (defaultSaleSpec) {
            await client.update(
              'bean_sale_specs',
              {
                unit_price: input.defaultSaleUnitPrice,
              },
              {
                match: { id: defaultSaleSpec.id },
                select: '*',
              },
            );
          }

          return;
        }

        if (!defaultSaleSpec) {
          await client.insert('bean_sale_specs', {
            channel: 'default',
            green_bean_id: beanId,
            is_default: true,
            unit_price: input.defaultSaleUnitPrice,
            unit_weight_grams: input.defaultSaleUnitWeightGrams,
          });
          return;
        }

        await client.update(
          'bean_sale_specs',
          {
            unit_price: input.defaultSaleUnitPrice,
            unit_weight_grams: input.defaultSaleUnitWeightGrams,
          },
          {
            match: { id: defaultSaleSpec.id },
            select: '*',
          },
        );
      }, undefined);
    },
  };
}
