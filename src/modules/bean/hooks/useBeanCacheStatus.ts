import { useEffect, useState } from 'react';

import {
  beanCacheService,
  beanCacheUpdatedEventName,
  type BeanCacheStatus,
} from '@/modules/bean/services/beanCache.service';

export function useBeanCacheStatus() {
  const [status, setStatus] = useState<BeanCacheStatus>(() => beanCacheService.getStatus());

  useEffect(() => {
    const syncStatus = () => {
      setStatus(beanCacheService.getStatus());
    };

    syncStatus();
    window.addEventListener(beanCacheUpdatedEventName, syncStatus);
    window.addEventListener('storage', syncStatus);

    return () => {
      window.removeEventListener(beanCacheUpdatedEventName, syncStatus);
      window.removeEventListener('storage', syncStatus);
    };
  }, []);

  return status;
}
