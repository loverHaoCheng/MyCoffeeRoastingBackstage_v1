import Spin from 'antd/es/spin';
import { useEffect, useMemo, useState } from 'react';

import { useBeans } from '@/modules/bean/hooks/useBeans';
import { calculateRoastSaleCapacity, resolveBeanCostTemplate } from '@/modules/finance/services/financeProfitCalculation.service';
import { useRoastPlans } from '@/modules/roast/hooks';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { useUpdateRoastBatch } from '@/modules/roast/hooks/useRoastBatches';
import type { RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';
import { FieldEditorDrawer } from '@/shared/components/FieldEditorDrawer';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { createRoastBatchDraft } from './RoastBatchFieldEditorDrawer/createRoastBatchDraft';
import { FIELD_LABELS, type RoastBatchEditableFieldPath } from './RoastBatchFieldEditorDrawer/fieldLabels';
import { updateRoastBatchDraft } from './RoastBatchFieldEditorDrawer/updateRoastBatchDraft';
import { useValidateAndSubmit } from './RoastBatchFieldEditorDrawer/useValidateAndSubmit';
import { renderBatchField } from './RoastBatchFieldEditorDrawer/renderBatchField';

export type { RoastBatchEditableFieldPath };

interface RoastBatchFieldEditorDrawerProps {
  batch: RoastBatchRecord | null;
  fieldPath?: RoastBatchEditableFieldPath;
  height?: string;
  onClose: () => void;
  open: boolean;
  placement?: 'bottom' | 'right';
  width?: number;
}

export function RoastBatchFieldEditorDrawer({
  batch,
  fieldPath,
  height,
  onClose,
  open,
  placement,
  width,
}: RoastBatchFieldEditorDrawerProps) {
  const { data: beans = [] } = useBeans();
  const { data: plans = [] } = useRoastPlans();
  const { costTemplateSettings } = useCostTemplateSettings();
  const updateBatchMutation = useUpdateRoastBatch();
  const { validateAndSubmit } = useValidateAndSubmit();
  const [draft, setDraft] = useState<RoastBatchUpdateInput | null>(null);
  const [lastOpenContext, setLastOpenContext] = useState<{
    batch: RoastBatchRecord;
    fieldPath: RoastBatchEditableFieldPath;
  } | null>(null);

  const editableFieldPath = fieldPath;
  useEffect(() => {
    if (open && batch != null && editableFieldPath != null) {
      setLastOpenContext({
        batch,
        fieldPath: editableFieldPath,
      });
    }
  }, [batch, editableFieldPath, open]);

  const effectiveBatch = open && batch != null ? batch : lastOpenContext?.batch ?? null;
  const effectiveFieldPath = open && editableFieldPath != null ? editableFieldPath : lastOpenContext?.fieldPath;
  const fieldLabel = effectiveFieldPath ? FIELD_LABELS[effectiveFieldPath] : '信息';

  const maximumSoldUnitCount = useMemo(() => {
    const bean = beans.find((item) => String(item.id) === String(draft?.greenBeanId));

    if (!bean || !draft?.inputWeightGrams) {
      return null;
    }

    const template = resolveBeanCostTemplate(bean, new Map(costTemplateSettings.templates.map((item) => [item.id, item])));
    return template ? calculateRoastSaleCapacity(draft.inputWeightGrams, template).maximumSoldUnitCount : null;
  }, [beans, costTemplateSettings.templates, draft?.greenBeanId, draft?.inputWeightGrams]);

  useEffect(() => {
    setDraft(createRoastBatchDraft(effectiveBatch));
  }, [effectiveBatch, effectiveFieldPath]);

  if (effectiveBatch == null || effectiveFieldPath == null) {
    return null;
  }

  if (draft == null) {
    return (
      <AppDrawer
        destroyOnHidden
        height={height}
        onClose={onClose}
        open={open}
        placement={placement}
        title={`修改${fieldLabel}`}
        width={width}
      >
        <section style={{ display: 'grid', placeItems: 'center', minHeight: '240px' }}>
          <Spin />
        </section>
      </AppDrawer>
    );
  }

  const updateDraft = <K extends RoastBatchEditableFieldPath>(key: K, value: RoastBatchUpdateInput[K]) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return updateRoastBatchDraft(current, key, value, beans, plans);
    });
  };

  const handleSubmit = () => {
    validateAndSubmit({
      draft,
      batchId: effectiveBatch.id,
      maximumSoldUnitCount,
      onClose,
      updateBatchMutation,
    });
  };

  return (
    <FieldEditorDrawer
      height={height}
      loadingLabel="保存中"
      onClose={onClose}
      onSubmit={handleSubmit}
      open={open}
      placement={placement}
      submitLabel={`保存${fieldLabel}`}
      title={`修改${fieldLabel}`}
      width={width}
    >
      <section style={{ display: 'grid', gap: '10px', padding: 0 }}>
        <label style={{ display: 'grid', gap: '6px' }}>
          <span style={{ color: 'var(--app-text-secondary)', fontSize: 'var(--app-font-14)', fontWeight: 700 }}>{fieldLabel}</span>
          {renderBatchField({
            draft,
            effectiveFieldPath,
            fieldLabel,
            beans,
            plans,
            maximumSoldUnitCount,
            updateDraft,
          })}
        </label>
      </section>
    </FieldEditorDrawer>
  );
}
