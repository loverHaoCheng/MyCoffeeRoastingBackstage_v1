import { AppError } from '@/shared/errors/AppError';
import type { PocketBaseRestClient } from '@/shared/services/pocketBaseRestClient';

import type { RoastPlanDisposition } from '../bean.service.types';

export function createBeanDeleter(
  client: Pick<PocketBaseRestClient, 'delete' | 'list' | 'request' | 'update'>,
  tableName: string,
) {
  return {
    deleteBean: async (beanId: string | number, roastPlanDisposition: RoastPlanDisposition): Promise<void> => {
      // 优先走服务端事务级联删除端点：单事务内完成全部删除，要么全成功、要么全回滚。
      try {
        const disposition = roastPlanDisposition === 'makeGeneric' ? 'makeGeneric' : 'delete';
        await client.request(
          `/api/green-beans/${encodeURIComponent(String(beanId))}?roastPlanDisposition=${disposition}`,
          { method: 'DELETE' },
        );
        return;
      } catch (error) {
        // 仅当服务端尚未部署该端点（404/405）时，回退到旧的客户端级联删除。
        const status = error instanceof AppError ? error.status : undefined;

        if (status !== 404 && status !== 405) {
          throw error;
        }
      }

      const relatedRoastBatches = await client.list<{ id: string }>('roast_batches', {
        match: { green_bean_id: beanId },
        select: 'id',
      });

      await Promise.all(
        relatedRoastBatches.map((batch) =>
          client.delete('roast_curve_records', { match: { roast_batch_id: batch.id } }),
        ),
      );
      await client.delete('roast_batches', { match: { green_bean_id: beanId } });
      await client.delete('green_bean_purchase_batches', { match: { green_bean_id: beanId } });
      await client.delete('roast_records', { match: { green_bean_id: beanId } });

      if (roastPlanDisposition === 'makeGeneric') {
        const relatedRoastProfiles = await client.list<{ id: string }>('roast_profiles', {
          match: { green_bean_id: beanId },
          select: 'id',
        });

        await Promise.all(
          relatedRoastProfiles.map((profile) =>
            client.update('roast_profiles', { green_bean_id: null }, {
              match: { id: profile.id },
              select: 'id',
            }),
          ),
        );
      } else {
        await client.delete('roast_profiles', { match: { green_bean_id: beanId } });
      }

      await client.delete('bean_sale_specs', { match: { green_bean_id: beanId } });
      await client.delete(tableName, { match: { id: beanId } });
    },
  };
}
