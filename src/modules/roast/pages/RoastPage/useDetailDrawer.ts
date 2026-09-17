import { useCallback, useState } from 'react';
import type { RoastPlanEditableFieldPath } from '@/modules/roast/components/RoastPlanFieldEditorDrawer';
import type { RoastPlan } from '@/types/domain';

export type DetailMode = 'view' | 'edit';

export const useDetailDrawer = () => {
  const [selectedPlanId, setSelectedPlanId] = useState<RoastPlan['id'] | null>(null);
  const [selectedPlanFieldPath, setSelectedPlanFieldPath] = useState<RoastPlanEditableFieldPath | 'steps' | undefined>();
  const [detailMode, setDetailMode] = useState<DetailMode | null>(null);

  const handleView = useCallback((planId: RoastPlan['id']) => {
    setSelectedPlanId(planId);
    setSelectedPlanFieldPath(undefined);
    setDetailMode('view');
  }, []);

  const handleEdit = useCallback((planId: RoastPlan['id'], fieldPath?: RoastPlanEditableFieldPath | 'steps') => {
    setSelectedPlanId(planId);
    setSelectedPlanFieldPath(fieldPath);
    setDetailMode('edit');
  }, []);

  const handleEditAll = useCallback((planId: RoastPlan['id']) => {
    setSelectedPlanId(planId);
    setSelectedPlanFieldPath(undefined);
    setDetailMode('edit');
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedPlanId(null);
    setSelectedPlanFieldPath(undefined);
    setDetailMode(null);
  }, []);

  return {
    selectedPlanId,
    selectedPlanFieldPath,
    detailMode,
    handleView,
    handleEdit,
    handleEditAll,
    closeDetail,
  };
};
