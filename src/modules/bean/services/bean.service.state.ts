import type { Bean } from '@/types/domain';

import { localGreenBeanService, mapLocalGreenBeanRecordToBean } from './localGreenBean.service';

export const pendingOptimisticCreateBeanIds = new Set<string>();

export const addPendingOptimisticCreateBeanId = (beanId: string): void => {
  pendingOptimisticCreateBeanIds.add(beanId);
};

export const removePendingOptimisticCreateBeanId = (beanId: string): void => {
  pendingOptimisticCreateBeanIds.delete(beanId);
};

export const getVisibleLocalBeans = (): Bean[] => {
  return localGreenBeanService
    .listRecords()
    .filter((record) => pendingOptimisticCreateBeanIds.has(record.id))
    .map(mapLocalGreenBeanRecordToBean);
};

export const clearPendingOptimisticCreateBeanIds = (): void => {
  pendingOptimisticCreateBeanIds.clear();
};

export const pruneInvisibleLocalBeans = (): void => {
  localGreenBeanService.listRecords().forEach((record) => {
    if (!pendingOptimisticCreateBeanIds.has(record.id)) {
      localGreenBeanService.removeById(record.id);
    }
  });
};
