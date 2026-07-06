import { CopyOutlined, DownOutlined, SyncOutlined } from '@ant-design/icons';
import { App, Alert, Button, Grid, Input, InputNumber, Popconfirm, Radio, Select, Slider, Tag } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';

import { useBeanCacheStatus } from '@/modules/bean/hooks';
import { beanQueryKeys } from '@/modules/bean/hooks';
import { roastBatchQueryKeys, roastPlanQueryKeys } from '@/modules/roast/hooks';
import { cardDisplayModules } from '@/modules/settings/constants/cardDisplayModules';
import { costTemplateFormSchema, supabaseConnectionFormSchema } from '@/modules/settings/schemas';
import { useAppDisplaySettings, useCostTemplateSettings, useSupabaseConnectionSettings } from '@/modules/settings/hooks';
import { appDisplaySettingsSyncService } from '@/modules/settings/services/appDisplaySettingsSync.service';
import { supabaseConnectionProbeService } from '@/modules/settings/services/supabaseConnectionProbe.service';
import { costTemplateSyncService } from '@/modules/settings/services/costTemplateSync.service';
import { refreshAllAppData } from '@/app/services/appDataRefresh.service';
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
  type SupabaseDataSource,
  type SupabaseConnectionFormValues,
  type SupabaseProjectConnection,
} from '@/modules/settings/types';
import { AppError, type AppErrorCode } from '@/shared/errors/AppError';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { scrollToField } from '@/shared/forms/scrollToField';
import authorCodeImage from '@/assets/settings-codes/author-code.png';
import sponsorCodeImage from '@/assets/settings-codes/sponsor-code.png';
import { useAppBuildVersion } from '@/app/hooks/useAppBuildVersion';

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
  if (!hasConnection) {
    return '未配置连接';
  }

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

  return '已配置，待首次同步';
};

const getLastSyncLabel = (value: null | string, hasConnection: boolean): string => {
  if (!hasConnection) {
    return '未连接';
  }

  return formatStatusTime(value);
};

const isValidProjectConnection = (projectUrl: string, publishableKey: string): boolean => {
  const normalizedUrl = projectUrl.trim();
  const normalizedKey = publishableKey.trim();

  if (!normalizedUrl || !normalizedKey || /\s/.test(normalizedKey)) {
    return false;
  }

  try {
    const url = new URL(normalizedUrl);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
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

type ConnectionProbeStatus = 'checking' | 'connected' | 'error' | 'idle';

const getConnectionTagColor = (
  hasConnection: boolean,
  probeStatus: ConnectionProbeStatus,
): 'blue' | 'default' | 'green' | 'orange' => {
  if (!hasConnection) {
    return 'default';
  }

  if (probeStatus === 'error') {
    return 'orange';
  }

  if (probeStatus === 'checking') {
    return 'blue';
  }

  return 'green';
};

const getConnectionTagLabel = (
  hasConnection: boolean,
  probeStatus: ConnectionProbeStatus,
): string => {
  if (!hasConnection) {
    return '未连接';
  }

  if (probeStatus === 'error') {
    return '连接异常';
  }

  if (probeStatus === 'checking') {
    return '检查中';
  }

  return '已连接';
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

const copyTextToClipboard = async (text: string): Promise<void> => {
  if (typeof navigator !== 'undefined' && 'clipboard' in navigator) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error('当前环境不支持复制');
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
  const beanCacheStatus = useBeanCacheStatus();
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
  const { loadSupabaseConnections, saveSupabaseConnections, supabaseConnections } = useSupabaseConnectionSettings();
  const {
    clearErrors,
    control,
    formState: { errors },
    getValues,
    reset,
    setError,
  } = useForm<SupabaseConnectionFormValues>({
    defaultValues: {
      greenBean: supabaseConnections.greenBean,
      roastedBean: supabaseConnections.roastedBean,
    },
  });
  const watchedValues = useWatch<SupabaseConnectionFormValues>({
    control,
    defaultValue: getValues(),
  });
  const lastSavedValuesRef = useRef(JSON.stringify(supabaseConnections));
  const lastGreenBeanRefreshSignatureRef = useRef('');
  const [connectionProbeState, setConnectionProbeState] = useState<Record<SupabaseDataSource, ConnectionProbeStatus>>({
    greenBean: 'idle',
    roastedBean: 'idle',
  });
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<null | string>(null);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [isAdvancedRefreshing, setIsAdvancedRefreshing] = useState(false);
  const [visibleCode, setVisibleCode] = useState<null | QrCodeKey>(null);
  const [templateDraft, setTemplateDraft] = useState<CostTemplateFormValues>(createEmptyCostTemplateFormValues());
  const [templateErrors, setTemplateErrors] = useState<Partial<Record<keyof CostTemplateFormValues, string>>>({});
  const [collapsedSections, setCollapsedSections] = useState(() => {
    const collapsedByDefault = import.meta.env.MODE !== 'test';

    return {
      costTemplates: collapsedByDefault,
      displayScale: collapsedByDefault,
      greenBean: collapsedByDefault,
      roastedBean: collapsedByDefault,
    };
  });
  const hasBootstrapConnection = isValidProjectConnection(
    supabaseConnections.greenBean.projectUrl,
    supabaseConnections.greenBean.publishableKey,
  );
  const hasRoastedBeanConnection = isValidProjectConnection(
    supabaseConnections.roastedBean.projectUrl,
    supabaseConnections.roastedBean.publishableKey,
  );
  const greenBeanDraftConnection: SupabaseProjectConnection = {
    projectUrl: watchedValues.greenBean?.projectUrl ?? '',
    publishableKey: watchedValues.greenBean?.publishableKey ?? '',
  };
  const canRunAdvancedRefresh = isValidProjectConnection(
    greenBeanDraftConnection.projectUrl,
    greenBeanDraftConnection.publishableKey,
  );
  const shouldShowSyncAlert =
    hasBootstrapConnection &&
    beanCacheStatus.errorCode != null &&
    (beanCacheStatus.status === 'error' || beanCacheStatus.status === 'fallback');

  const refreshGreenBeanDependencies = useCallback(async (connectionSignature: string) => {
    if (!connectionSignature || lastGreenBeanRefreshSignatureRef.current === connectionSignature) {
      return;
    }

    lastGreenBeanRefreshSignatureRef.current = connectionSignature;
    await costTemplateSyncService.syncSafely(costTemplateSettings);
    await appDisplaySettingsSyncService.syncSafely(appDisplaySettings);
    loadCostTemplates();
    loadAppDisplaySettings();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: beanQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: roastPlanQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: roastBatchQueryKeys.all }),
    ]);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: beanQueryKeys.all, type: 'active' }),
      queryClient.refetchQueries({ queryKey: roastPlanQueryKeys.all, type: 'active' }),
      queryClient.refetchQueries({ queryKey: roastBatchQueryKeys.all, type: 'active' }),
    ]);
  }, [appDisplaySettings, costTemplateSettings, loadAppDisplaySettings, loadCostTemplates, queryClient]);

  const snapshotSupabaseConnectionDraft = useCallback(() => {
      const nextValues = getValues();
      const draftValues: SupabaseConnectionFormValues = {
        greenBean: {
          projectUrl: nextValues.greenBean.projectUrl,
          publishableKey: nextValues.greenBean.publishableKey,
        },
        roastedBean: {
          projectUrl: nextValues.roastedBean.projectUrl,
          publishableKey: nextValues.roastedBean.publishableKey,
        },
      };
    const serializedValues = JSON.stringify(draftValues);

    if (serializedValues !== lastSavedValuesRef.current) {
      saveSupabaseConnections(draftValues);
      lastSavedValuesRef.current = serializedValues;
    }

    return draftValues;
  }, [getValues, saveSupabaseConnections]);

  const verifyConnection = useCallback(
    async (dataSource: SupabaseDataSource, connection: SupabaseProjectConnection) => {
      setConnectionProbeState((current) => ({
        ...current,
        [dataSource]: 'checking',
      }));

      try {
        await supabaseConnectionProbeService.verify(dataSource, connection);
        setConnectionProbeState((current) => ({
          ...current,
          [dataSource]: 'connected',
        }));
        return true;
      } catch {
        setConnectionProbeState((current) => ({
          ...current,
          [dataSource]: 'error',
        }));
        return false;
      }
    },
    [],
  );

  const persistSupabaseConnectionDraft = useCallback(
    async (dataSource: SupabaseDataSource) => {
      const draftValues = snapshotSupabaseConnectionDraft();

      const connection = draftValues[dataSource];
      const isValidConnection = isValidProjectConnection(
        connection.projectUrl,
        connection.publishableKey,
      );

      if (!isValidConnection) {
        setConnectionProbeState((current) => ({
          ...current,
          [dataSource]: 'idle',
        }));
        return;
      }

      const isVerified = await verifyConnection(dataSource, connection);

      if (!isVerified || dataSource !== 'greenBean') {
        return;
      }

      const signature = JSON.stringify({
        projectUrl: connection.projectUrl.trim(),
        publishableKey: connection.publishableKey.trim(),
      });

      void refreshGreenBeanDependencies(signature);
    },
    [refreshGreenBeanDependencies, snapshotSupabaseConnectionDraft, verifyConnection],
  );

  const handleAdvancedRefresh = useCallback(async () => {
    const draftValues = snapshotSupabaseConnectionDraft();
    const greenBeanConnection = draftValues.greenBean;

    if (!isValidProjectConnection(greenBeanConnection.projectUrl, greenBeanConnection.publishableKey)) {
      void message.warning('请先填写有效的生豆数据库连接，再使用完全同步。');
      return;
    }

    setIsAdvancedRefreshing(true);

    try {
      const result = await refreshAllAppData(queryClient);

      if (result.failed > 0) {
        void message.warning('完全同步部分失败，已尽量完成双向同步。');
        return;
      }

      if (result.downloaded > 0 || result.uploaded > 0 || result.success > 0) {
        void message.success('完全同步完成，已完成双向同步。');
        return;
      }

      void message.info('完全同步完成，当前已是最新数据。');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '完全同步失败，请稍后重试。';
      void message.error(errorMessage);
    } finally {
      setIsAdvancedRefreshing(false);
    }
  }, [message, queryClient, snapshotSupabaseConnectionDraft]);

  useEffect(() => {
    loadAppDisplaySettings();
    loadSupabaseConnections();
    loadCostTemplates();
  }, [loadAppDisplaySettings, loadCostTemplates, loadSupabaseConnections]);

  useEffect(() => {
    if (!hasBootstrapConnection) {
      return;
    }

    const signature = JSON.stringify({
      projectUrl: supabaseConnections.greenBean.projectUrl.trim(),
      publishableKey: supabaseConnections.greenBean.publishableKey.trim(),
    });

    void refreshGreenBeanDependencies(signature);
  }, [
    hasBootstrapConnection,
    refreshGreenBeanDependencies,
    supabaseConnections.greenBean.projectUrl,
    supabaseConnections.greenBean.publishableKey,
  ]);

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

  const handleCopyGreenBeanInitSql = async () => {
    try {
      const { default: greenBeanSupabaseInitSql } = await import('../../../../supabase/init.sql?raw');
      await copyTextToClipboard(greenBeanSupabaseInitSql);
      void message.success('最新生豆 Supabase 建库 SQL 已复制');
    } catch {
      void message.error('复制失败，请检查浏览器剪贴板权限');
    }
  };

  const handleCopyRoastedBeanInitSql = async () => {
    try {
      const { default: roastedBeanSupabaseInitSql } = await import('../../../../supabase/roasted-bean-init.sql?raw');
      await copyTextToClipboard(roastedBeanSupabaseInitSql);
      void message.success('熟豆 Supabase 初始化 SQL 已复制');
    } catch {
      void message.error('复制失败，请检查浏览器剪贴板权限');
    }
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
    void costTemplateSyncService.syncSafely(nextSettings);

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
      const firstField = result.error.issues
        .map((issue) => issue.path[0] as keyof CostTemplateFormValues | undefined)
        .find((field): field is keyof CostTemplateFormValues => field != null);

      if (firstField) {
        scrollToField(firstField);
      }
      return;
    }

    const savedTemplate = saveCostTemplate(result.data, isCreatingTemplate ? undefined : editingTemplateId ?? undefined);
    void costTemplateSyncService.syncSafely({
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
        <article className={styles.statusInlineBar}>
          <div className={styles.statusInlineGroup}>
            <strong className={styles.statusInlineValue}>
              {getSyncStatusLabel(beanCacheStatus.status, hasBootstrapConnection)}
            </strong>
          </div>
          <div className={styles.statusInlineDivider} />
          <div className={styles.statusInlineGroup}>
            <strong className={styles.statusInlineValue}>
              {getLastSyncLabel(beanCacheStatus.syncedAt, hasBootstrapConnection)}
            </strong>
          </div>
        </article>

        <section className={styles.section} data-collapsed={collapsedSections.greenBean}>
          <header className={styles.sectionHeader}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionHeaderTitleGroup}>
                <h2>生豆数据库</h2>
                <Tag color={getConnectionTagColor(hasBootstrapConnection, connectionProbeState.greenBean)}>
                  {getConnectionTagLabel(hasBootstrapConnection, connectionProbeState.greenBean)}
                </Tag>
              </div>
              <Button
                aria-label={collapsedSections.greenBean ? '展开' : '收起'}
                className={styles.collapseButton}
                data-expanded={!collapsedSections.greenBean}
                icon={<DownOutlined />}
                onClick={() => {
                  toggleSection('greenBean');
                }}
                type="text"
              />
            </div>
          </header>
          <div aria-hidden={collapsedSections.greenBean} className={styles.sectionCollapse} data-collapsed={collapsedSections.greenBean}>
            <div className={styles.sectionCollapseInner}>
              {shouldShowSyncAlert ? (
                <Alert
                  className={styles.syncAlert}
                  description={getSyncAlertDescription(beanCacheStatus.errorCode)}
                  message={getSyncAlertTitle(beanCacheStatus.status)}
                  showIcon
                  type={beanCacheStatus.status === 'fallback' ? 'warning' : 'error'}
                />
              ) : null}
              <div className={styles.sectionActions}>
                <Button icon={<CopyOutlined />} onClick={() => void handleCopyGreenBeanInitSql()}>
                  复制最新生豆建库 SQL
                </Button>
                <Button
                  disabled={!canRunAdvancedRefresh}
                  icon={<SyncOutlined />}
                  loading={isAdvancedRefreshing}
                  onClick={() => void handleAdvancedRefresh()}
                >
                  完全同步
                </Button>
              </div>
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
                        onBlur={() => {
                          field.onBlur();
                          void persistSupabaseConnectionDraft('greenBean');
                        }}
                        placeholder="https://your-green-bean-project.supabase.co"
                        status={errors.greenBean?.projectUrl ? 'error' : undefined}
                      />
                    )}
                  />
                  {errors.greenBean?.projectUrl?.message ? <span className={styles.helpText}>{errors.greenBean.projectUrl.message}</span> : null}
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
                        onBlur={() => {
                          field.onBlur();
                          void persistSupabaseConnectionDraft('greenBean');
                        }}
                        placeholder="sb_publishable_xxx 或匿名公开 key"
                        status={errors.greenBean?.publishableKey ? 'error' : undefined}
                      />
                    )}
                  />
                  {errors.greenBean?.publishableKey?.message ? (
                    <span className={styles.helpText}>{errors.greenBean.publishableKey.message}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} data-collapsed={collapsedSections.roastedBean}>
          <header className={styles.sectionHeader}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionHeaderTitleGroup}>
                <h2>熟豆数据库</h2>
                <Tag color={getConnectionTagColor(hasRoastedBeanConnection, connectionProbeState.roastedBean)}>
                  {getConnectionTagLabel(hasRoastedBeanConnection, connectionProbeState.roastedBean)}
                </Tag>
              </div>
              <Button
                aria-label={collapsedSections.roastedBean ? '展开' : '收起'}
                className={styles.collapseButton}
                data-expanded={!collapsedSections.roastedBean}
                icon={<DownOutlined />}
                onClick={() => {
                  toggleSection('roastedBean');
                }}
                type="text"
              />
            </div>
          </header>
          <div aria-hidden={collapsedSections.roastedBean} className={styles.sectionCollapse} data-collapsed={collapsedSections.roastedBean}>
            <div className={styles.sectionCollapseInner}>
              <div className={styles.sectionActions}>
                <Button icon={<CopyOutlined />} onClick={() => void handleCopyRoastedBeanInitSql()}>
                  复制熟豆建库 SQL
                </Button>
              </div>
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
                        onBlur={() => {
                          field.onBlur();
                          void persistSupabaseConnectionDraft('roastedBean');
                        }}
                        placeholder="https://your-roasted-bean-project.supabase.co"
                        status={errors.roastedBean?.projectUrl ? 'error' : undefined}
                      />
                    )}
                  />
                  {errors.roastedBean?.projectUrl?.message ? (
                    <span className={styles.helpText}>{errors.roastedBean.projectUrl.message}</span>
                  ) : null}
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
                        onBlur={() => {
                          field.onBlur();
                          void persistSupabaseConnectionDraft('roastedBean');
                        }}
                        placeholder="sb_publishable_xxx 或匿名公开 key"
                        status={errors.roastedBean?.publishableKey ? 'error' : undefined}
                      />
                    )}
                  />
                  {errors.roastedBean?.publishableKey?.message ? (
                    <span className={styles.helpText}>{errors.roastedBean.publishableKey.message}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

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
                            disabled={isDefault}
                            onClick={() => {
                              setDefaultCostTemplate(template.id);
                              void costTemplateSyncService.syncSafely({
                                ...costTemplateSettings,
                                defaultTemplateId: template.id,
                                updatedAt: new Date().toISOString(),
                              });
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
