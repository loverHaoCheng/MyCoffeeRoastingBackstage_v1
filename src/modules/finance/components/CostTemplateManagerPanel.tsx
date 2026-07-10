import { DownOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { App, Button, Input, InputNumber, Popconfirm, Tag } from 'antd';
import { useEffect, useId, useState } from 'react';

import { costTemplateFormSchema } from '@/modules/settings/schemas';
import { useCostTemplateSettings } from '@/modules/settings/hooks';
import { costTemplateSyncService } from '@/modules/settings/services/costTemplateSync.service';
import {
  createEmptyCostTemplateFormValues,
  type CostTemplate,
  type CostTemplateFormValues,
} from '@/modules/settings/types';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { scrollToField } from '@/shared/forms/scrollToField';

import styles from './CostTemplateManagerPanel.module.css';

const mapCostTemplateToFormValues = (template: CostTemplate): CostTemplateFormValues => ({
  dehydrationRate: template.dehydrationRate,
  energyCost: template.energyCost,
  laborCost: template.laborCost,
  name: template.name,
  notes: template.notes,
  otherCost: template.otherCost,
  packagingCost: template.packagingCost,
  roastInputWeightGrams: template.roastInputWeightGrams,
  saleUnitWeightGrams: template.saleUnitWeightGrams,
  targetProfitRate: template.targetProfitRate,
});

const joinClassNames = (...classNames: (string | undefined)[]) => {
  return classNames.filter(Boolean).join(' ');
};

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
  const visibleTemplates = primaryTemplate ? [primaryTemplate, ...(isCollapsed ? [] : secondaryTemplates)] : [];
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
            {costTemplateSettings.templates.length === 0 ? (
              <div className={styles.emptyState}>还没有成本模板，先新建一个模板即可在财务与生豆流程中复用。</div>
            ) : (
              <div className={styles.templateGrid}>
                {visibleTemplates.map((template) => {
                  const isDefault = template.id === costTemplateSettings.defaultTemplateId;
                  const isEditing = isTemplateDrawerOpen && !isCreatingTemplate && template.id === editingTemplateId;

                  return (
                    <article className={styles.templateCard} data-active={isEditing} key={template.id}>
                      <div className={styles.templateCardHeader}>
                        <div className={styles.templateTitleBlock}>
                          <strong>{template.name}</strong>
                          {isDefault ? <Tag color="green">默认模板</Tag> : null}
                        </div>
                        <span className={styles.templateMeta}>
                          生豆 {template.roastInputWeightGrams}g · 单份 {template.saleUnitWeightGrams}g · 利润率 {template.targetProfitRate}%
                        </span>
                      </div>
                      <div className={styles.templateStats}>
                        <span>脱水率 {template.dehydrationRate}%</span>
                        <span>包装 ¥{template.packagingCost.toFixed(2)}</span>
                        <span>能耗 ¥{template.energyCost.toFixed(2)}</span>
                        <span>人工 ¥{template.laborCost.toFixed(2)}</span>
                        <span>其他 ¥{template.otherCost.toFixed(2)}</span>
                      </div>
                      {template.notes ? <p className={styles.templateNotes}>{template.notes}</p> : null}
                      <div className={styles.templateActions}>
                        <Button
                          onClick={() => {
                            handleEditTemplate(template);
                          }}
                          type={isEditing ? 'primary' : 'default'}
                        >
                          编辑
                        </Button>
                        <Button
                          onClick={() => {
                            handleUpdateDefaultTemplate(isDefault ? null : template.id);
                          }}
                        >
                          {isDefault ? '取消默认' : '设为默认'}
                        </Button>
                        <Popconfirm
                          cancelText="取消"
                          okText="删除"
                          onConfirm={() => {
                            handleDeleteTemplate(template);
                          }}
                          title={`删除模板「${template.name}」？`}
                        >
                          <Button danger>
                            删除
                          </Button>
                        </Popconfirm>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {shouldShowCollapseToggle ? (
          <div className={styles.collapseFooter}>
            <Button
              aria-controls={collapseRegionId}
              aria-expanded={!isCollapsed}
              className={styles.collapseToggle}
              icon={<DownOutlined />}
              onClick={handleToggleCollapse}
              type="text"
            >
              {isCollapsed ? '展开' : '收起'}
            </Button>
          </div>
        ) : null}
      </section>

      <AppDrawer
        className={styles.templateDrawer}
        height="82dvh"
        onClose={handleCloseTemplateDrawer}
        open={isTemplateDrawerOpen}
        placement="bottom"
        title={isCreatingTemplate ? '新建模板' : '编辑模板'}
      >
        <section className={styles.templateDrawerPanel}>
          <header className={styles.templateEditorHeader}>
            <span className={styles.templateEditorHint}>模板会在生豆创建与财务核算时用于复用默认成本参数。</span>
          </header>

          <div className={styles.fieldGrid}>
            <div className={styles.field} data-field-path="name">
              <label htmlFor="template-name">模板名称</label>
              <Input
                id="template-name"
                onChange={(event) => {
                  handleTemplateFieldChange('name', event.target.value);
                }}
                placeholder="例如 默认零售 100g"
                status={templateErrors.name ? 'error' : undefined}
                value={templateDraft.name}
              />
              <span className={styles.helpText}>{templateErrors.name ?? '用于生豆创建时快速选择模板'}</span>
            </div>

            <div className={joinClassNames(styles.field, styles.fieldCompact)} data-field-path="roastInputWeightGrams">
              <label htmlFor="template-roast-input-weight">生豆重量</label>
              <InputNumber
                id="template-roast-input-weight"
                min={1}
                onChange={(value) => {
                  handleTemplateFieldChange('roastInputWeightGrams', value ?? 0);
                }}
                precision={0}
                status={templateErrors.roastInputWeightGrams ? 'error' : undefined}
                suffix="g"
                value={templateDraft.roastInputWeightGrams}
              />
              <span className={styles.helpText}>{templateErrors.roastInputWeightGrams ?? '会带入生豆默认单次烘焙量'}</span>
            </div>

            <div className={joinClassNames(styles.field, styles.fieldCompact)} data-field-path="saleUnitWeightGrams">
              <label htmlFor="template-sale-unit-weight">出售单份熟豆重量</label>
              <InputNumber
                id="template-sale-unit-weight"
                min={1}
                onChange={(value) => {
                  handleTemplateFieldChange('saleUnitWeightGrams', value ?? 0);
                }}
                precision={0}
                status={templateErrors.saleUnitWeightGrams ? 'error' : undefined}
                suffix="g"
                value={templateDraft.saleUnitWeightGrams}
              />
              <span className={styles.helpText}>{templateErrors.saleUnitWeightGrams ?? '会带入生豆默认零售规格'}</span>
            </div>

            <div className={joinClassNames(styles.field, styles.fieldCompact)} data-field-path="dehydrationRate">
              <label htmlFor="template-dehydration-rate">脱水率</label>
              <InputNumber
                id="template-dehydration-rate"
                max={100}
                min={0}
                onChange={(value) => {
                  handleTemplateFieldChange('dehydrationRate', value ?? 0);
                }}
                precision={1}
                status={templateErrors.dehydrationRate ? 'error' : undefined}
                suffix="%"
                value={templateDraft.dehydrationRate}
              />
              <span className={styles.helpText}>{templateErrors.dehydrationRate ?? '用于推算单锅出豆量'}</span>
            </div>

            <div className={joinClassNames(styles.field, styles.fieldCompact)} data-field-path="targetProfitRate">
              <label htmlFor="template-target-profit-rate">目标利润率</label>
              <InputNumber
                id="template-target-profit-rate"
                min={0}
                onChange={(value) => {
                  handleTemplateFieldChange('targetProfitRate', value ?? 0);
                }}
                precision={1}
                status={templateErrors.targetProfitRate ? 'error' : undefined}
                suffix="%"
                value={templateDraft.targetProfitRate}
              />
              <span className={styles.helpText}>
                {templateErrors.targetProfitRate ?? '利润率 =（售价 - 单份总成本）÷ 售价 × 100%'}
              </span>
            </div>

            <div className={joinClassNames(styles.field, styles.fieldCompact)} data-field-path="packagingCost">
              <label htmlFor="template-packaging-cost">包装费用</label>
              <InputNumber
                id="template-packaging-cost"
                min={0}
                onChange={(value) => {
                  handleTemplateFieldChange('packagingCost', value ?? 0);
                }}
                precision={2}
                prefix="¥"
                status={templateErrors.packagingCost ? 'error' : undefined}
                value={templateDraft.packagingCost}
              />
              <span className={styles.helpText}>{templateErrors.packagingCost ?? '按单锅计入总成本'}</span>
            </div>

            <div className={joinClassNames(styles.field, styles.fieldCompact)} data-field-path="energyCost">
              <label htmlFor="template-energy-cost">能耗费用</label>
              <InputNumber
                id="template-energy-cost"
                min={0}
                onChange={(value) => {
                  handleTemplateFieldChange('energyCost', value ?? 0);
                }}
                precision={2}
                prefix="¥"
                status={templateErrors.energyCost ? 'error' : undefined}
                value={templateDraft.energyCost}
              />
              <span className={styles.helpText}>{templateErrors.energyCost ?? '按单锅计入总成本'}</span>
            </div>

            <div className={joinClassNames(styles.field, styles.fieldCompact)} data-field-path="laborCost">
              <label htmlFor="template-labor-cost">人工费用</label>
              <InputNumber
                id="template-labor-cost"
                min={0}
                onChange={(value) => {
                  handleTemplateFieldChange('laborCost', value ?? 0);
                }}
                precision={2}
                prefix="¥"
                status={templateErrors.laborCost ? 'error' : undefined}
                value={templateDraft.laborCost}
              />
              <span className={styles.helpText}>{templateErrors.laborCost ?? '按单锅计入总成本'}</span>
            </div>

            <div className={joinClassNames(styles.field, styles.fieldCompact)} data-field-path="otherCost">
              <label htmlFor="template-other-cost">其他费用</label>
              <InputNumber
                id="template-other-cost"
                min={0}
                onChange={(value) => {
                  handleTemplateFieldChange('otherCost', value ?? 0);
                }}
                precision={2}
                prefix="¥"
                status={templateErrors.otherCost ? 'error' : undefined}
                value={templateDraft.otherCost}
              />
              <span className={styles.helpText}>{templateErrors.otherCost ?? '用于礼盒、耗材等附加成本'}</span>
            </div>
          </div>

          <div className={styles.field} data-field-path="notes">
            <label htmlFor="template-notes">模板备注</label>
            <Input.TextArea
              id="template-notes"
              autoSize={{ minRows: 3, maxRows: 5 }}
              onChange={(event) => {
                handleTemplateFieldChange('notes', event.target.value);
              }}
              placeholder="例如 适用于常规 100g 零售袋，包装和人工按默认门店标准分摊"
              status={templateErrors.notes ? 'error' : undefined}
              value={templateDraft.notes}
            />
            <span className={styles.helpText}>{templateErrors.notes ?? '便于团队区分不同销售场景'}</span>
          </div>

          <DrawerActionBar compact>
            <Button onClick={handleCloseTemplateDrawer}>取消</Button>
            <Button
              icon={isCreatingTemplate ? <PlusOutlined /> : <SaveOutlined />}
              onClick={handleSaveTemplate}
              type="primary"
            >
              {isCreatingTemplate ? '创建模板' : '保存模板'}
            </Button>
          </DrawerActionBar>
        </section>
      </AppDrawer>
    </>
  );
}
