import { useCallback, useMemo, useState } from 'react';
import type { FieldPath } from 'react-hook-form';

import type { Bean } from '@/types/domain';
import type { GreenBeanFormInput, GreenBeanCreateInput } from '@/modules/bean/types';
import { mapBeanToRestockInitialValues } from './beanRestock';

export type BeanDetailMode = 'view' | 'edit';

export const useBeanDetailDrawer = (beans: Bean[]) => {
  const [selectedBeanId, setSelectedBeanId] = useState<null | Bean['id']>(null);
  const [selectedBeanFieldPath, setSelectedBeanFieldPath] = useState<FieldPath<GreenBeanFormInput> | undefined>();
  const [detailMode, setDetailMode] = useState<BeanDetailMode | null>(null);
  const [restockInitialValues, setRestockInitialValues] = useState<GreenBeanCreateInput | undefined>();
  const [restockRequestKey, setRestockRequestKey] = useState<number | null>(null);

  const selectedBean = useMemo(() => {
    return beans.find((b) => b.id === selectedBeanId) ?? null;
  }, [beans, selectedBeanId]);

  const handleViewBean = useCallback((beanId: Bean['id']) => {
    setSelectedBeanId(beanId);
    setSelectedBeanFieldPath(undefined);
    setDetailMode('view');
  }, []);

  const handleEditBean = useCallback((beanId: Bean['id'], fieldPath?: FieldPath<GreenBeanFormInput>) => {
    setSelectedBeanId(beanId);
    setSelectedBeanFieldPath(fieldPath);
    setDetailMode('edit');
  }, []);

  const handleEditBeanAll = useCallback((beanId: Bean['id']) => {
    setSelectedBeanId(beanId);
    setSelectedBeanFieldPath(undefined);
    setDetailMode('edit');
  }, []);

  const handleRestockBean = useCallback((bean: Bean) => {
    setRestockInitialValues(mapBeanToRestockInitialValues(bean));
    setRestockRequestKey(Date.now());
  }, []);

  const closeDetailDrawer = useCallback(() => {
    setSelectedBeanId(null);
    setSelectedBeanFieldPath(undefined);
    setDetailMode(null);
  }, []);

  return {
    selectedBean,
    selectedBeanId,
    selectedBeanFieldPath,
    detailMode,
    restockInitialValues,
    restockRequestKey,
    handleViewBean,
    handleEditBean,
    handleEditBeanAll,
    handleRestockBean,
    closeDetailDrawer,
  };
};
