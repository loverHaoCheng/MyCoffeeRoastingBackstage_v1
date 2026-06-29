import { App, Alert, Button, Drawer, Grid, Input, InputNumber, Popconfirm, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { useBeanCacheStatus } from '@/modules/bean/hooks';
import { costTemplateFormSchema, supabaseConnectionFormSchema } from '@/modules/settings/schemas';
import { useCostTemplateSettings, useSupabaseConnectionSettings } from '@/modules/settings/hooks';
import {
  createEmptyCostTemplateFormValues,
  type CostTemplate,
  type CostTemplateFormValues,
  type SupabaseConnectionFormValues,
} from '@/modules/settings/types';
import { AppError, type AppErrorCode } from '@/shared/errors/AppError';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './SettingsPage.module.css';

const { useBreakpoint } = Grid;

const formatStatusTime = (value: null | string): string => {
  if (!value) {
    return '暂无记录';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const getSyncStatusLabel = (
  status: 'cached' | 'empty' | 'error' | 'fallback' | 'idle',
  hasConnection: boolean,
): string => {
  if (status === 'cached') {
    return '已同步完成';
  }

  if (status === 'empty') {
    return '已连接，当前库为空';
  }

  if (status === 'fallback') {
    return '已回退到本地缓存';
  }

  if (status === 'error') {
    return '同步异常';
  }

  if (hasConnection) {
    return '已配置，待首次同步';
  }

  return '未配置连接';
};

const getSyncStatusTone = (
  status: 'cached' | 'empty' | 'error' | 'fallback' | 'idle',
  hasConnection: boolean,
): 'blue' | 'default' | 'gold' | 'green' | 'red' => {
  if (status === 'cached') {
    return 'green';
  }

  if (status === 'empty') {
    return 'blue';
  }

  if (status === 'fallback') {
    return 'gold';
  }

  if (status === 'error') {
    return 'red';
  }

  if (hasConnection) {
    return 'blue';
  }

  return 'default';
};

const getSourceLabel = (source: 'mock' | 'supabase' | null): string => {
  if (source === 'supabase') {
    return 'Supabase 实时同步';
  }

  if (source === 'mock') {
    return '本地离线数据';
  }

  return '未初始化';
};

const isAppErrorCode = (value: null | string): value is AppErrorCode => {
  return (
    value === 'AUTH' ||
    value === 'BUSINESS' ||
    value === 'CONFIG' ||
    value === 'DATA' ||
    value === 'HTTP' ||
    value === 'NETWORK' ||
    value === 'RATE_LIMIT' ||
    value === 'TIMEOUT' ||
    value === 'UNKNOWN'
  );
};

const getSyncAlertTitle = (status: 'cached' | 'empty' | 'error' | 'fallback' | 'idle'): string => {
  if (status === 'fallback') {
    return '生豆数据同步异常，当前已回退到本地缓存';
  }

  return '生豆数据暂时无法同步';
};

const getSyncAlertDescription = (errorCode: null | string): string => {
  if (!isAppErrorCode(errorCode)) {
    return '请检查当前网络、Supabase 访问策略或表结构配置。';
  }

  return getUserFacingErrorMessage(new AppError('', { code: errorCode }));
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

export function SettingsPage() {
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const beanCacheStatus = useBeanCacheStatus();
  const {
    costTemplateSettings,
    deleteCostTemplate,
    loadCostTemplates,
    saveCostTemplate,
    setDefaultCostTemplate,
  } = useCostTemplateSettings();
  const { loadSupabaseConnections, saveSupabaseConnections, supabaseConnections } = useSupabaseConnectionSettings();
  const {
    clearErrors,
    control,
    formState: { errors },
    reset,
    setError,
  } = useForm<SupabaseConnectionFormValues>({
    defaultValues: {
      greenBean: supabaseConnections.greenBean,
      roastedBean: supabaseConnections.roastedBean,
    },
  });
  const watchedValues = useWatch({ control });
  const lastSavedValuesRef = useRef(JSON.stringify(supabaseConnections));
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<null | string>(null);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<CostTemplateFormValues>(createEmptyCostTemplateFormValues());
  const [templateErrors, setTemplateErrors] = useState<Partial<Record<keyof CostTemplateFormValues, string>>>({});
  const hasBootstrapConnection =
    supabaseConnections.greenBean.projectUrl.trim().length > 0 &&
    supabaseConnections.greenBean.publishableKey.trim().length > 0;
  const hasRoastedBeanConnection =
    supabaseConnections.roastedBean.projectUrl.trim().length > 0 &&
    supabaseConnections.roastedBean.publishableKey.trim().length > 0;
  const shouldShowSyncAlert =
    hasBootstrapConnection &&
    beanCacheStatus.errorCode != null &&
    (beanCacheStatus.status === 'error' || beanCacheStatus.status === 'fallback');

  useEffect(() => {
    loadSupabaseConnections();
    loadCostTemplates();
  }, [loadCostTemplates, loadSupabaseConnections]);

  useEffect(() => {
    reset({
      greenBean: supabaseConnections.greenBean,
      roastedBean: supabaseConnections.roastedBean,
    });
    lastSavedValuesRef.current = JSON.stringify({
      greenBean: supabaseConnections.greenBean,
      roastedBean: supabaseConnections.roastedBean,
    });
  }, [reset, supabaseConnections]);

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

  useEffect(() => {
    if (!watchedValues?.greenBean || !watchedValues?.roastedBean) {
      return;
    }

    const draftValues: SupabaseConnectionFormValues = {
      greenBean: {
        projectUrl: watchedValues.greenBean.projectUrl ?? '',
        publishableKey: watchedValues.greenBean.publishableKey ?? '',
      },
      roastedBean: {
        projectUrl: watchedValues.roastedBean.projectUrl ?? '',
        publishableKey: watchedValues.roastedBean.publishableKey ?? '',
      },
    };
    const serializedValues = JSON.stringify(draftValues);

    if (serializedValues === lastSavedValuesRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      saveSupabaseConnections(draftValues);
      lastSavedValuesRef.current = serializedValues;
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [saveSupabaseConnections, watchedValues]);

  useEffect(() => {
    const result = supabaseConnectionFormSchema.safeParse(watchedValues);

    clearErrors();

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.') as
          | 'greenBean.projectUrl'
          | 'greenBean.publishableKey'
          | 'roastedBean.projectUrl'
          | 'roastedBean.publishableKey';

        setError(path, {
          message: issue.message,
          type: 'manual',
        });
      });

      return;
    }
  }, [clearErrors, setError, watchedValues]);

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

    if (editingTemplateId === template.id) {
      handleCloseTemplateDrawer();
      setEditingTemplateId(null);
      setTemplateDraft(createEmptyCostTemplateFormValues());
    }

    void message.success('成本模板已删除');
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
      return;
    }

    const savedTemplate = saveCostTemplate(result.data, isCreatingTemplate ? undefined : editingTemplateId ?? undefined);
    setIsCreatingTemplate(false);
    setEditingTemplateId(savedTemplate.id);
    setIsTemplateDrawerOpen(false);
    setTemplateDraft(mapCostTemplateToFormValues(savedTemplate));
    setTemplateErrors({});
    void message.success(isCreatingTemplate ? '成本模板已创建' : '成本模板已更新');
  };

  return (
    <main className={styles.page}>
      {shouldShowSyncAlert ? (
        <Alert
          className={styles.syncAlert}
          description={getSyncAlertDescription(beanCacheStatus.errorCode)}
          message={getSyncAlertTitle(beanCacheStatus.status)}
          showIcon
          type={beanCacheStatus.status === 'fallback' ? 'warning' : 'error'}
        />
      ) : null}

      <form className={styles.form}>
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div className={styles.sectionHeaderRow}>
              <h2>生豆数据库</h2>
              <Tag color={hasBootstrapConnection ? 'green' : 'default'}>
                {hasBootstrapConnection ? '已连接' : '未连接'}
              </Tag>
            </div>
            <p className={styles.sectionStatusCopy}>
              {hasBootstrapConnection ? '当前会尝试连接生豆 Supabase 项目。' : '未填写完整连接信息时，不会发起生豆同步请求。'}
            </p>
          </header>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="green-bean-project-url">Project URL</label>
              <Controller
                control={control}
                name="greenBean.projectUrl"
                render={({ field }) => (
                  <Input
                    {...field}
                    id="green-bean-project-url"
                    placeholder="https://your-green-bean-project.supabase.co"
                    status={errors.greenBean?.projectUrl ? 'error' : undefined}
                  />
                )}
              />
              <span className={styles.helpText}>
                {errors.greenBean?.projectUrl?.message ?? '示例：https://xxx.supabase.co'}
              </span>
            </div>
            <div className={styles.field}>
              <label htmlFor="green-bean-publishable-key">Publishable Key</label>
              <Controller
                control={control}
                name="greenBean.publishableKey"
                render={({ field }) => (
                  <Input
                    {...field}
                    id="green-bean-publishable-key"
                    placeholder="sb_publishable_xxx 或匿名公开 key"
                    status={errors.greenBean?.publishableKey ? 'error' : undefined}
                  />
                )}
              />
              <span className={styles.helpText}>
                {errors.greenBean?.publishableKey?.message ?? '前端只应使用公开可暴露的 publishable key'}
              </span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div className={styles.sectionHeaderRow}>
              <h2>熟豆数据库</h2>
              <Tag color={hasRoastedBeanConnection ? 'green' : 'default'}>
                {hasRoastedBeanConnection ? '已连接' : '未连接'}
              </Tag>
            </div>
            <p className={styles.sectionStatusCopy}>
              {hasRoastedBeanConnection
                ? '当前会尝试连接熟豆 Supabase 项目，后续新增烘焙记录会同步写入熟豆库。'
                : '熟豆数据库可暂时留空；未配置时，未来新增烘焙记录不会同步到熟豆库。'}
            </p>
          </header>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="roasted-bean-project-url">Project URL</label>
              <Controller
                control={control}
                name="roastedBean.projectUrl"
                render={({ field }) => (
                  <Input
                    {...field}
                    id="roasted-bean-project-url"
                    placeholder="https://your-roasted-bean-project.supabase.co"
                    status={errors.roastedBean?.projectUrl ? 'error' : undefined}
                  />
                )}
              />
              <span className={styles.helpText}>
                {errors.roastedBean?.projectUrl?.message ?? '留空则不启用熟豆同步；填写后新增烘焙会同步到熟豆库'}
              </span>
            </div>
            <div className={styles.field}>
              <label htmlFor="roasted-bean-publishable-key">Publishable Key</label>
              <Controller
                control={control}
                name="roastedBean.publishableKey"
                render={({ field }) => (
                  <Input
                    {...field}
                    id="roasted-bean-publishable-key"
                    placeholder="sb_publishable_xxx 或匿名公开 key"
                    status={errors.roastedBean?.publishableKey ? 'error' : undefined}
                  />
                )}
              />
              <span className={styles.helpText}>
                {errors.roastedBean?.publishableKey?.message ?? '只在需要启用熟豆同步时填写这组连接信息'}
              </span>
            </div>
          </div>
        </section>

        <section className={styles.statusSection}>
          <header className={styles.sectionHeader}>
            <h2>当前数据同步状态</h2>
          </header>

          <div className={styles.statusGrid}>
            <article className={styles.statusCard}>
              <span>同步状态</span>
              <strong>{getSyncStatusLabel(beanCacheStatus.status, hasBootstrapConnection)}</strong>
            </article>
            <article className={styles.statusCard}>
              <span>最近同步</span>
              <strong>{formatStatusTime(beanCacheStatus.syncedAt)}</strong>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div className={styles.sectionHeaderRow}>
              <h2>成本模板</h2>
              <Button onClick={handleCreateTemplate} type="default">
                新建模板
              </Button>
            </div>
            <p className={styles.sectionStatusCopy}>
              成本核算已经并入设置。这里维护不同烘焙或销售场景下的模板，创建生豆时选择模板后，会自动换算默认熟豆规格与建议售价。
            </p>
          </header>

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
                      disabled={isDefault}
                      onClick={() => {
                        setDefaultCostTemplate(template.id);
                        void message.success('已设为默认模板');
                      }}
                    >
                      设为默认
                    </Button>
                    <Popconfirm
                      cancelText="取消"
                      okText="删除"
                      onConfirm={() => {
                        handleDeleteTemplate(template);
                      }}
                      title={`删除模板「${template.name}」？`}
                    >
                      <Button
                        danger
                        disabled={costTemplateSettings.templates.length <= 1}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </form>

      <Drawer
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
            <div className={styles.field}>
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

            <div className={styles.field}>
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

            <div className={styles.field}>
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

            <div className={styles.field}>
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

            <div className={styles.field}>
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

            <div className={styles.field}>
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

            <div className={styles.field}>
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

            <div className={styles.field}>
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

            <div className={styles.field}>
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

          <div className={styles.field}>
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

          <div className={styles.templateEditorActions}>
            <Button onClick={handleCloseTemplateDrawer}>取消</Button>
            <Button onClick={handleSaveTemplate} type="primary">
              {isCreatingTemplate ? '创建模板' : '保存模板'}
            </Button>
          </div>
        </section>
      </Drawer>
    </main>
  );
}
