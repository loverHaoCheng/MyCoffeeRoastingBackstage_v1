import { App } from 'antd';
import { useEffect, useId, useState } from 'react';

import { costTemplateFormSchema } from '@/modules/settings/schemas';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { costTemplateSyncService } from '@/modules/settings/services/costTemplateSync.service';
import {
  createEmptyCostTemplateFormValues,
  type CostTemplate,
  type CostTemplateFormValues,
} from '@/modules/settings/types';
import { scrollToField } from '@/shared/forms/scrollToField';

import { CostTemplateCardList } from './cost-template-manager/CostTemplateCardList';
import { CostTemplateEditorDrawer } from './cost-template-manager/CostTemplateEditorDrawer';
import { mapCostTemplateToFormValues } from './cost-template-manager/costTemplateManager.utils';
import styles from './CostTemplateManagerPanel.module.css';

interface CostTemplateManagerPanelProps {
  createRequestKey?: number;
}

export function CostTemplateManagerPanel({ createRequestKey = 0 }: CostTemplateManagerPanelProps) {
  const { message } = App.useApp();
  const {
    costTemplateSettings,
    deleteCostTemplate,
    loadCostTemplates,
    saveCostTemplate,
    setDefaultCostTemplate,
  } = useCostTemplateSettings();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const collapseRegionId = useId();
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<null | string>(null);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<CostTemplateFormValues>(createEmptyCostTemplateFormValues());
  const [templateErrors, setTemplateErrors] = useState<Partial<Record<keyof CostTemplateFormValues, string>>>({});
  const primaryTemplate =
    costTemplateSettings.templates.find((template) => template.id === costTemplateSettings.defaultTemplateId) ??
    costTemplateSettings.templates[0] ??
    null;
  const secondaryTemplates = primaryTemplate
    ? costTemplateSettings.templates.filter((template) => template.id !== primaryTemplate.id)
    : [];
  const visibleTemplates = primaryTemplate ? [primaryTemplate, ...secondaryTemplates] : [];
  const shouldShowCollapseToggle = secondaryTemplates.length > 0;

  useEffect(() => {
    loadCostTemplates();
  }, [loadCostTemplates]);

  useEffect(() => {
    if (createRequestKey <= 0) {
      return;
    }

    handleCreateTemplate();
  }, [createRequestKey]);

  useEffect(() => {
    if (isCreatingTemplate) {
      return;
    }

    const activeTemplate =
      costTemplateSettings.templates.find((template) => template.id === editingTemplateId) ??
      costTemplateSettings.templates.find((template) => template.id === costTemplateSettings.defaultTemplateId) ??
      costTemplateSettings.templates[0];

    if (!activeTemplate) {
      setEditingTemplateId(null);
      setTemplateDraft(createEmptyCostTemplateFormValues());
      return;
    }

    setEditingTemplateId(activeTemplate.id);
    setTemplateDraft(mapCostTemplateToFormValues(activeTemplate));
    setTemplateErrors({});
  }, [costTemplateSettings, editingTemplateId, isCreatingTemplate]);

  const handleTemplateFieldChange = <K extends keyof CostTemplateFormValues>(
    key: K,
    value: CostTemplateFormValues[K],
  ) => {
    setTemplateDraft((current) => ({
      ...current,
      [key]: value,
    }));
    setTemplateErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  };

  const handleCreateTemplate = () => {
    setIsCreatingTemplate(true);
    setEditingTemplateId(null);
    setIsTemplateDrawerOpen(true);
    setTemplateDraft(createEmptyCostTemplateFormValues());
    setTemplateErrors({});
  };

  const handleEditTemplate = (template: CostTemplate) => {
    setIsCreatingTemplate(false);
    setEditingTemplateId(template.id);
    setIsTemplateDrawerOpen(true);
    setTemplateDraft(mapCostTemplateToFormValues(template));
    setTemplateErrors({});
  };

  const handleCloseTemplateDrawer = () => {
    setIsTemplateDrawerOpen(false);
    setIsCreatingTemplate(false);
    setTemplateErrors({});
  };

  const handleDeleteTemplate = (template: CostTemplate) => {
    deleteCostTemplate(template.id);

    const nextSettings = {
      ...costTemplateSettings,
      defaultTemplateId:
        costTemplateSettings.defaultTemplateId === template.id
          ? costTemplateSettings.templates.find((item) => item.id !== template.id)?.id ?? null
          : costTemplateSettings.defaultTemplateId,
      templates: costTemplateSettings.templates.filter((item) => item.id !== template.id),
      updatedAt: new Date().toISOString(),
    };

    void costTemplateSyncService.syncLocalChangeSafely(nextSettings);

    if (editingTemplateId === template.id) {
      handleCloseTemplateDrawer();
      setEditingTemplateId(null);
      setTemplateDraft(createEmptyCostTemplateFormValues());
    }

    void message.success('成本模板已删除');
  };

  const handleUpdateDefaultTemplate = (templateId: null | string) => {
    setDefaultCostTemplate(templateId);

    void costTemplateSyncService.syncLocalChangeSafely({
      ...costTemplateSettings,
      defaultTemplateId: templateId,
      updatedAt: new Date().toISOString(),
    });

    void message.success(templateId == null ? '已取消默认模板' : '已设为默认模板');
  };

  const handleSaveTemplate = () => {
    const result = costTemplateFormSchema.safeParse(templateDraft);

    if (!result.success) {
      const nextErrors: Partial<Record<keyof CostTemplateFormValues, string>> = {};

      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof CostTemplateFormValues | undefined;

        if (!path) {
          return;
        }

        nextErrors[path] = issue.message;
      });

      setTemplateErrors(nextErrors);

      const firstField = result.error.issues
        .map((issue) => issue.path[0] as keyof CostTemplateFormValues | undefined)
        .find((field): field is keyof CostTemplateFormValues => field != null);

      if (firstField) {
        scrollToField(firstField);
      }
      return;
    }

    const savedTemplate = saveCostTemplate(result.data, isCreatingTemplate ? undefined : editingTemplateId ?? undefined);

    void costTemplateSyncService.syncLocalChangeSafely({
      defaultTemplateId: costTemplateSettings.defaultTemplateId ?? savedTemplate.id,
      templates: isCreatingTemplate
        ? [savedTemplate, ...costTemplateSettings.templates]
        : costTemplateSettings.templates.map((template) => (template.id === savedTemplate.id ? savedTemplate : template)),
      updatedAt: new Date().toISOString(),
    });

    setIsCreatingTemplate(false);
    setEditingTemplateId(savedTemplate.id);
    setIsTemplateDrawerOpen(false);
    setTemplateDraft(mapCostTemplateToFormValues(savedTemplate));
    setTemplateErrors({});
    void message.success(isCreatingTemplate ? '成本模板已创建' : '成本模板已更新');
  };

  const handleToggleCollapse = () => {
    setIsCollapsed((current) => !current);
  };

  return (
    <>
      <section className={styles.panel} data-collapsed={isCollapsed}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.titleGroup}>
              <h2>成本模板</h2>
            </div>
          </div>
        </header>

        <div className={styles.collapse} id={collapseRegionId}>
          <div className={styles.collapseInner}>
            <CostTemplateCardList
              collapseRegionId={collapseRegionId}
              editingTemplateId={isCreatingTemplate ? null : editingTemplateId}
              isCollapsed={isCollapsed}
              isTemplateDrawerOpen={isTemplateDrawerOpen}
              onDeleteTemplate={handleDeleteTemplate}
              onEditTemplate={handleEditTemplate}
              onToggleCollapse={handleToggleCollapse}
              onUpdateDefaultTemplate={handleUpdateDefaultTemplate}
              primaryTemplate={primaryTemplate}
              shouldShowCollapseToggle={shouldShowCollapseToggle}
              templates={visibleTemplates}
            />
          </div>
        </div>
      </section>

      <CostTemplateEditorDrawer
        isCreatingTemplate={isCreatingTemplate}
        isOpen={isTemplateDrawerOpen}
        onChangeField={handleTemplateFieldChange}
        onClose={handleCloseTemplateDrawer}
        onSave={handleSaveTemplate}
        templateDraft={templateDraft}
        templateErrors={templateErrors}
      />
    </>
  );
}
