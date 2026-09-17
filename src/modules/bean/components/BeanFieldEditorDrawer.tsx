import App from 'antd/es/app';
import { useQuery } from '@tanstack/react-query';
import { type FieldPath } from 'react-hook-form';
import { useEffect, useMemo, useRef, useState } from 'react';

import { beanEditableDetailQueryKeys } from '@/modules/bean/hooks/useBeanEditableDetail';
import { useUpdateBean } from '@/modules/bean/hooks/useBeans';
import { beanService } from '@/modules/bean/services';
import { greenBeanCreateFormSchema } from '@/modules/bean/schemas';
import type { GreenBeanFormInput } from '@/modules/bean/types/localGreenBean';
import { beanFlavorTagMaxCount } from '@/modules/bean/utils/flavorTags';
import { normalizeAgingDays, normalizeTastingEndDays } from '@/modules/bean/utils/postProcessDays';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { FieldEditorDrawer } from '@/shared/components/FieldEditorDrawer';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { submissionBackupService } from '@/shared/services/submissionBackup.service';
import type { Bean } from '@/types/domain';

import { type BeanEditableFieldPath, fieldMeta } from './BeanFieldEditorDrawer/fieldMeta';
import { createFallbackEditableDetail } from './BeanFieldEditorDrawer/fallbackUtils';
import { renderFieldControl } from './BeanFieldEditorDrawer/renderFieldControl';

interface BeanFieldEditorDrawerProps {
  bean: Bean | null;
  fieldPath?: FieldPath<GreenBeanFormInput>;
  onClose: () => void;
  open: boolean;
  placement?: 'bottom' | 'right';
  width?: number;
  height?: string;
}

export function BeanFieldEditorDrawer({
  bean,
  fieldPath,
  height,
  onClose,
  open,
  placement,
  width,
}: BeanFieldEditorDrawerProps) {
  const { message } = App.useApp();
  const updateBeanMutation = useUpdateBean();
  const { costTemplateSettings } = useCostTemplateSettings();
  const editableFieldPath = fieldPath as BeanEditableFieldPath | undefined;
  const [lastOpenContext, setLastOpenContext] = useState<{
    bean: Bean;
    fieldPath: BeanEditableFieldPath;
  } | null>(null);

  useEffect(() => {
    if (open && bean != null && editableFieldPath != null) {
      setLastOpenContext({
        bean,
        fieldPath: editableFieldPath,
      });
    }
  }, [bean, editableFieldPath, open]);

  const effectiveBean = open && bean != null ? bean : lastOpenContext?.bean ?? null;
  const effectiveFieldPath = open && editableFieldPath != null ? editableFieldPath : lastOpenContext?.fieldPath;
  const fieldConfig = effectiveFieldPath ? fieldMeta[effectiveFieldPath] : undefined;
  const fallbackDraft = useMemo(() => (effectiveBean ? createFallbackEditableDetail(effectiveBean) : null), [effectiveBean]);
  const editableDetailQuery = useQuery({
    enabled: open && effectiveBean != null && effectiveFieldPath != null,
    initialData: fallbackDraft ?? undefined,
    queryFn: async () => {
      if (!effectiveBean) {
        throw new Error('缺少生豆信息');
      }

      const response = await beanService.getEditableBean(effectiveBean.id);

      return response.data;
    },
    queryKey: effectiveBean == null ? beanEditableDetailQueryKeys.all : beanEditableDetailQueryKeys.detail(effectiveBean.id),
  });
  const [draft, setDraft] = useState<GreenBeanFormInput | null>(fallbackDraft);
  const hasUserEditedRef = useRef(false);
  const sessionKey = String(effectiveBean?.id ?? '') + ':' + (effectiveFieldPath ?? '');
  const currentDraft = draft ?? fallbackDraft;

  useEffect(() => {
    hasUserEditedRef.current = false;
    setDraft(editableDetailQuery.data ?? fallbackDraft);
  }, [editableDetailQuery.data, fallbackDraft, sessionKey]);

  useEffect(() => {
    if (hasUserEditedRef.current || !editableDetailQuery.data) {
      return;
    }

    setDraft(editableDetailQuery.data);
  }, [editableDetailQuery.data]);

  const fieldLabel = fieldConfig?.label ?? '修改信息';

  if (effectiveBean == null || effectiveFieldPath == null || currentDraft == null) {
    return null;
  }

  const handleSubmit = () => {
    const normalizedDraft: GreenBeanFormInput = {
      ...currentDraft,
      agingDays: normalizeAgingDays(currentDraft.agingDays),
      tastingEndDays: normalizeTastingEndDays(currentDraft.tastingEndDays, currentDraft.agingDays),
    };
    const parsed = greenBeanCreateFormSchema.safeParse(normalizedDraft);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      void message.error(firstIssue?.message ?? '保存失败，请检查输入');
      if (firstIssue?.path.length) {
        window.requestAnimationFrame(() => {
          const fieldName = firstIssue.path.join('.');
          const target = document.querySelector<HTMLElement>(`[data-field-path="${fieldName}"]`);
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      return;
    }

    onClose();
    const backupId = submissionBackupService.save('update', { beanId: effectiveBean.id, input: parsed.data }, 'bean');

    const updateTask = updateBeanMutation
      .mutateAsync({ beanId: effectiveBean.id, input: parsed.data })
      .then(() => {
        submissionBackupService.clear(backupId);
      })
      .catch((error: unknown) => {
        void message.error(getUserFacingErrorMessage(error, '生豆同步失败，本次修改未保存，请保留编辑内容并重试。'));
      });

    void updateTask;
  };

  const updateDraft = <K extends BeanEditableFieldPath>(key: K, value: GreenBeanFormInput[K]) => {
    hasUserEditedRef.current = true;
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextDraft: GreenBeanFormInput = { ...current };
      nextDraft[key] = value;

      return nextDraft;
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
          {renderFieldControl({
            effectiveFieldPath,
            currentDraft,
            costTemplateSettings,
            updateDraft,
          })}
          {editableFieldPath === 'flavorTags' ? (
            <span style={{ color: 'var(--app-text-secondary)', fontSize: 'var(--app-font-14)' }}>
              最多 {String(beanFlavorTagMaxCount)} 个标签
            </span>
          ) : null}
        </label>
      </section>
    </FieldEditorDrawer>
  );
}
