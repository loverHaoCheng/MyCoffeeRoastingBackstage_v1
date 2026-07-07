import { DownOutlined } from '@ant-design/icons';
import { App, Button, Grid, Input, InputNumber, Popconfirm, Radio, Select, Slider, Tag } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { beanEditableDetailQueryKeys, beanQueryKeys } from '@/modules/bean/hooks';
import { roastBatchQueryKeys, roastPlanQueryKeys } from '@/modules/roast/hooks';
import { cardDisplayModules } from '@/modules/settings/constants/cardDisplayModules';
import { costTemplateFormSchema } from '@/modules/settings/schemas';
import { useAppDisplaySettings, useCostTemplateSettings, usePocketBaseConnectionSettings } from '@/modules/settings/hooks';
import { appDisplaySettingsSyncService } from '@/modules/settings/services/appDisplaySettingsSync.service';
import { costTemplateSyncService } from '@/modules/settings/services/costTemplateSync.service';
import {
  appDisplayScaleMax,
  appDisplayScaleMin,
  appDisplayScaleStep,
  createEmptyCostTemplateFormValues,
  type AppCardModuleKey,
  type AppDisplaySettings,
  type AppThemeMode,
  type CostTemplate,
  type CostTemplateFormValues,
} from '@/modules/settings/types';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { scrollToField } from '@/shared/forms/scrollToField';
import authorCodeImage from '@/assets/settings-codes/author-code.png';
import sponsorCodeImage from '@/assets/settings-codes/sponsor-code.png';
import { useAppBuildVersion } from '@/app/hooks/useAppBuildVersion';
import { RoastedBeanConnectionCard } from '@/modules/settings/components/RoastedBeanConnectionCard';

import styles from './SettingsPage.module.css';

const { useBreakpoint } = Grid;
type QrCodeKey = 'author' | 'sponsor';
const qrCodeEntries: Record<
  QrCodeKey,
  {
    alt: string;
    buttonLabel: string;
    image: string;
  }
> = {
  author: {
    alt: '作者交流二维码',
    buttonLabel: '和作者交流一下',
    image: authorCodeImage,
  },
  sponsor: {
    alt: '赞助支持二维码',
    buttonLabel: '请作者喝杯咖啡',
    image: sponsorCodeImage,
  },
};

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

const joinClassNames = (...classNames: (string | undefined)[]): string => {
  return classNames.filter(Boolean).join(' ');
};

const formatPercentLabel = (value: number): string => {
  return `${String(Math.round(value * 100))}%`;
};

const cardDisplayCountOptions: { label: string; value: 0 | 2 | 4 }[] = [
  { label: '0 项', value: 0 },
  { label: '2 项', value: 2 },
  { label: '4 项', value: 4 },
];

const themeModeOptions: { label: string; value: AppThemeMode }[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
];

const getCardDisplayModuleDefinition = (moduleKey: AppCardModuleKey) => {
  return cardDisplayModules.find((module) => module.key === moduleKey);
};

export function SettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const screens = useBreakpoint();
  const appBuildVersion = useAppBuildVersion();
  const {
    appDisplaySettings,
    loadAppDisplaySettings,
    saveAppDisplaySettings,
  } = useAppDisplaySettings();
  const {
    costTemplateSettings,
    deleteCostTemplate,
    loadCostTemplates,
    saveCostTemplate,
    setDefaultCostTemplate,
  } = useCostTemplateSettings();
  const { loadPocketBaseConnections, pocketBaseConnections } = usePocketBaseConnectionSettings();
  const lastGreenBeanRefreshSignatureRef = useRef('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<null | string>(null);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [visibleCode, setVisibleCode] = useState<null | QrCodeKey>(null);
  const [templateDraft, setTemplateDraft] = useState<CostTemplateFormValues>(createEmptyCostTemplateFormValues());
  const [templateErrors, setTemplateErrors] = useState<Partial<Record<keyof CostTemplateFormValues, string>>>({});
  const [collapsedSections, setCollapsedSections] = useState(() => {
    const collapsedByDefault = import.meta.env.MODE !== 'test';

    return {
      costTemplates: collapsedByDefault,
      displayScale: collapsedByDefault,
    };
  });
  const refreshGreenBeanDependencies = useCallback(async (connectionSignature: string) => {
    if (!connectionSignature || lastGreenBeanRefreshSignatureRef.current === connectionSignature) {
      return;
    }

    lastGreenBeanRefreshSignatureRef.current = connectionSignature;
    queryClient.removeQueries({ queryKey: beanQueryKeys.all });
    queryClient.removeQueries({ queryKey: beanEditableDetailQueryKeys.all });
    queryClient.removeQueries({ queryKey: roastPlanQueryKeys.all });
    queryClient.removeQueries({ queryKey: roastBatchQueryKeys.all });
  }, [queryClient]);

  useEffect(() => {
    loadAppDisplaySettings();
    loadPocketBaseConnections();
    loadCostTemplates();
  }, [loadAppDisplaySettings, loadCostTemplates, loadPocketBaseConnections]);

  useEffect(() => {
    const projectUrl = pocketBaseConnections.greenBean.projectUrl.trim();

    if (projectUrl.length === 0) {
      return;
    }

    const signature = JSON.stringify({ projectUrl });

    void refreshGreenBeanDependencies(signature);
  }, [
    refreshGreenBeanDependencies,
    pocketBaseConnections.greenBean.projectUrl,
  ]);

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

  const persistAppDisplaySettings = useCallback(
    (nextSettings: AppDisplaySettings) => {
      const savedSettings = saveAppDisplaySettings(nextSettings);

      void appDisplaySettingsSyncService.syncSafely(savedSettings);

      return savedSettings;
    },
    [saveAppDisplaySettings],
  );

  const getDefaultVisibleKeys = useCallback((moduleKey: AppCardModuleKey): string[] => {
    return getCardDisplayModuleDefinition(moduleKey)?.metaOptions.map((item) => item.key) ?? [];
  }, []);

  const normalizeCardDisplayMetaKeys = useCallback(
    (moduleKey: AppCardModuleKey, selectedKeys: string[], displayCount: 0 | 2 | 4): string[] => {
      if (displayCount === 0) {
        return [];
      }

      const defaultKeys = getDefaultVisibleKeys(moduleKey);
      const nextKeys = Array.from(
        new Set(selectedKeys.filter((key) => defaultKeys.includes(key))),
      ).slice(0, displayCount);

      while (nextKeys.length < displayCount) {
        const fallbackKey = defaultKeys.find((key) => !nextKeys.includes(key));

        if (!fallbackKey) {
          break;
        }

        nextKeys.push(fallbackKey);
      }

      return nextKeys;
    },
    [getDefaultVisibleKeys],
  );

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

  const handleToggleCode = (code: 'author' | 'sponsor') => {
    setVisibleCode((current) => (current === code ? null : code));
  };

  const activeQrEntry = visibleCode ? qrCodeEntries[visibleCode] : null;

  const toggleSection = (key: keyof typeof collapsedSections) => {
    setCollapsedSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleDisplayScaleChange = (value: number) => {
    persistAppDisplaySettings({
      ...appDisplaySettings,
      scale: Number(value.toFixed(2)),
    });
  };

  const handleThemeModeChange = (themeMode: AppThemeMode) => {
    persistAppDisplaySettings({
      ...appDisplaySettings,
      themeMode,
    });
  };

  const handleCardDisplayCountChange = (moduleKey: AppCardModuleKey, displayCount: 0 | 2 | 4) => {
    const moduleSettings = appDisplaySettings.cardDisplaySettings[moduleKey];

    persistAppDisplaySettings({
      ...appDisplaySettings,
      cardDisplaySettings: {
        ...appDisplaySettings.cardDisplaySettings,
        [moduleKey]: {
          displayCount,
          visibleMetaKeys: normalizeCardDisplayMetaKeys(moduleKey, moduleSettings.visibleMetaKeys, displayCount),
        },
      },
    });
  };

  const handleCardVisibleMetaKeyChange = (
    moduleKey: AppCardModuleKey,
    slotIndex: number,
    selectedKey: string,
  ) => {
    const moduleSettings = appDisplaySettings.cardDisplaySettings[moduleKey];
    const nextSelectedKeys = [...moduleSettings.visibleMetaKeys];
    nextSelectedKeys[slotIndex] = selectedKey;

    persistAppDisplaySettings({
      ...appDisplaySettings,
      cardDisplaySettings: {
        ...appDisplaySettings.cardDisplaySettings,
        [moduleKey]: {
          ...moduleSettings,
          visibleMetaKeys: normalizeCardDisplayMetaKeys(
            moduleKey,
            nextSelectedKeys,
            moduleSettings.displayCount,
          ),
        },
      },
    });
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
      defaultTemplateId:
        costTemplateSettings.defaultTemplateId ?? savedTemplate.id,
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

  return (
    <main className={styles.page}>
      <form className={styles.form}>
        <RoastedBeanConnectionCard />

        <section className={styles.section} data-collapsed={collapsedSections.displayScale}>
          <header className={styles.sectionHeader}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionHeaderTitleGroup}>
                <h2>界面外观</h2>
                <Tag color={appDisplaySettings.themeMode === 'dark' ? 'default' : 'blue'}>
                  {appDisplaySettings.themeMode === 'dark' ? '深色' : '浅色'}
                </Tag>
                <Tag color="blue">{Math.round(appDisplaySettings.scale * 100)}%</Tag>
              </div>
              <Button
                aria-label={collapsedSections.displayScale ? '展开' : '收起'}
                className={styles.collapseButton}
                data-expanded={!collapsedSections.displayScale}
                icon={<DownOutlined />}
                onClick={() => {
                  toggleSection('displayScale');
                }}
                type="text"
              />
            </div>
          </header>
          <div aria-hidden={collapsedSections.displayScale} className={styles.sectionCollapse} data-collapsed={collapsedSections.displayScale}>
            <div className={styles.sectionCollapseInner}>
              <div className={styles.appearanceGrid}>
                <article className={styles.appearanceBlock}>
                  <div className={styles.appearanceBlockHeader}>
                    <div>
                      <strong>主题模式</strong>
                      <p>在浅色和深色之间切换，布局与卡片会保持统一风格。</p>
                    </div>
                    <Tag color={appDisplaySettings.themeMode === 'dark' ? 'default' : 'blue'}>
                      {appDisplaySettings.themeMode === 'dark' ? '深色' : '浅色'}
                    </Tag>
                  </div>
                  <Radio.Group
                    buttonStyle="solid"
                    className={styles.themeModeGroup}
                    options={themeModeOptions}
                    optionType="button"
                    onChange={(event) => {
                      handleThemeModeChange(event.target.value as AppThemeMode);
                    }}
                    value={appDisplaySettings.themeMode}
                  />
                </article>

                <article className={styles.appearanceBlock}>
                  <div className={styles.appearanceBlockHeader}>
                    <div>
                      <strong>显示缩放</strong>
                      <p>按需调整内容整体缩放，仅在本机生效，不会同步到云端。</p>
                    </div>
                  </div>
                  <div className={styles.zoomPanel}>
                    <Slider
                      marks={{
                        [appDisplayScaleMin]: formatPercentLabel(appDisplayScaleMin),
                        1: '100%',
                        [appDisplayScaleMax]: formatPercentLabel(appDisplayScaleMax),
                      }}
                      max={appDisplayScaleMax}
                      min={appDisplayScaleMin}
                      onChange={handleDisplayScaleChange}
                      step={appDisplayScaleStep}
                      tooltip={{ formatter: (value) => formatPercentLabel(value ?? 1) }}
                      value={appDisplaySettings.scale}
                    />
                    <div className={styles.zoomActions}>
                      <Button
                        onClick={() => {
                          handleDisplayScaleChange(1);
                        }}
                      >
                        恢复 100%
                      </Button>
                      <Button
                        onClick={() => {
                          handleDisplayScaleChange(1);
                          void message.success('显示缩放已恢复默认');
                        }}
                      >
                        重置缩放设置
                      </Button>
                    </div>
                  </div>
                </article>
              </div>

              <article className={styles.cardDisplayPanel}>
                <div className={styles.cardDisplayHeader}>
                  <div>
                    <strong>卡片信息展示</strong>
                    <p>每个模块都可以选择 0 / 2 / 4 项信息，并按位置指定展示内容。</p>
                  </div>
                  <Tag color="default">共 {cardDisplayModules.length} 个模块</Tag>
                </div>

                <div className={styles.cardDisplayGrid}>
                  {cardDisplayModules.map((module) => {
                    const moduleSettings = appDisplaySettings.cardDisplaySettings[module.key];
                    const visibleSlots = Array.from(
                      { length: moduleSettings.displayCount },
                      (_, index) => index,
                    );

                    return (
                      <article className={styles.cardDisplayModule} key={module.key}>
                        <div className={styles.cardDisplayModuleHeader}>
                          <div>
                            <strong>{module.label}</strong>
                            <p>{module.description}</p>
                          </div>
                          <Tag>{moduleSettings.displayCount} 项</Tag>
                        </div>

                        <Radio.Group
                          buttonStyle="solid"
                          className={styles.cardDisplayCountGroup}
                          options={cardDisplayCountOptions}
                          optionType="button"
                          onChange={(event) => {
                            handleCardDisplayCountChange(module.key, event.target.value as 0 | 2 | 4);
                          }}
                          value={moduleSettings.displayCount}
                        />

                        {visibleSlots.length > 0 ? (
                          <div className={styles.cardDisplaySlotGrid}>
                            {visibleSlots.map((slotIndex) => {
                              const currentValue = moduleSettings.visibleMetaKeys[slotIndex];

                              return (
                                <div className={styles.cardDisplaySlot} key={slotIndex}>
                                  <span className={styles.cardDisplaySlotLabel}>
                                    第 {slotIndex + 1} 项
                                  </span>
                                  <Select
                                    className={styles.cardDisplaySelect}
                                    aria-label={`第 ${String(slotIndex + 1)} 项卡片信息选择`}
                                    options={module.metaOptions.map((option) => ({
                                      disabled:
                                        option.key !== currentValue &&
                                        moduleSettings.visibleMetaKeys.some(
                                          (selectedKey, selectedIndex) =>
                                            selectedIndex !== slotIndex && selectedKey === option.key,
                                        ),
                                      label: option.label,
                                      value: option.key,
                                    }))}
                                    onChange={(value) => {
                                      handleCardVisibleMetaKeyChange(module.key, slotIndex, value);
                                    }}
                                    placeholder={`请选择第 ${String(slotIndex + 1)} 项`}
                                    value={currentValue}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.section} data-collapsed={collapsedSections.costTemplates}>
          <header className={styles.sectionHeader}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionHeaderTitleGroup}>
                <h2>成本模板</h2>
              </div>
              <Button
                aria-label={collapsedSections.costTemplates ? '展开' : '收起'}
                className={styles.collapseButton}
                data-expanded={!collapsedSections.costTemplates}
                icon={<DownOutlined />}
                onClick={() => {
                  toggleSection('costTemplates');
                }}
                type="text"
              />
            </div>
          </header>
          <div aria-hidden={collapsedSections.costTemplates} className={styles.sectionCollapse} data-collapsed={collapsedSections.costTemplates}>
            <div className={styles.sectionCollapseInner}>
              <div className={styles.sectionActions}>
                <Button className={styles.sectionActionButtonFull} onClick={handleCreateTemplate} type="default">
                  新建模板
                </Button>
              </div>

              {costTemplateSettings.templates.length === 0 ? (
                <div className={styles.templateEmptyState}>还没有成本模板，先新建一个模板即可在创建生豆时复用。</div>
              ) : (
                <div className={styles.templateGrid}>
                  {costTemplateSettings.templates.map((template) => {
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
        </section>

        <section className={styles.qrSection} data-expanded={visibleCode ? 'true' : 'false'}>
          <div className={styles.qrActions}>
            {(Object.entries(qrCodeEntries) as [QrCodeKey, (typeof qrCodeEntries)[QrCodeKey]][]).map(([code, entry]) => (
              <Button
                aria-pressed={visibleCode === code}
                className={styles.qrButton}
                key={code}
                onClick={() => {
                  handleToggleCode(code);
                }}
                type={visibleCode === code ? 'primary' : 'default'}
              >
                {entry.buttonLabel}
              </Button>
            ))}
          </div>

          <div aria-hidden={!visibleCode} className={styles.sectionCollapse} data-collapsed={!visibleCode}>
            <div className={styles.sectionCollapseInner}>
              {activeQrEntry ? (
                <div className={styles.qrPanel}>
                  <div className={styles.qrCard} key={visibleCode}>
                    <img alt={activeQrEntry.alt} className={styles.qrImage} src={activeQrEntry.image} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <p className={styles.buildVersion}>
          当前 Web 上传版本：
          {appBuildVersion}
        </p>
      </form>

      <AppDrawer
        className={styles.templateDrawer}
        onClose={handleCloseTemplateDrawer}
        open={isTemplateDrawerOpen}
        placement={screens.md ? 'right' : 'bottom'}
        title={isCreatingTemplate ? '新建模板' : '编辑模板'}
        width={screens.md ? 460 : undefined}
        height={screens.md ? undefined : '82vh'}
      >
        <section className={styles.templateDrawerPanel}>
          <header className={styles.templateEditorHeader}>
            <span className={styles.templateEditorHint}>模板会在生豆创建时用于自动计算默认熟豆售价。</span>
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
              <span className={styles.helpText}>
                {templateErrors.roastInputWeightGrams ?? '会带入生豆默认单次烘焙量'}
              </span>
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
              <span className={styles.helpText}>
                {templateErrors.saleUnitWeightGrams ?? '会带入生豆默认零售规格'}
              </span>
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
                {templateErrors.targetProfitRate ?? '据此自动反推默认熟豆建议售价'}
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
            <Button onClick={handleSaveTemplate} type="primary">
              {isCreatingTemplate ? '创建模板' : '保存模板'}
            </Button>
          </DrawerActionBar>
        </section>
      </AppDrawer>
    </main>
  );
}
