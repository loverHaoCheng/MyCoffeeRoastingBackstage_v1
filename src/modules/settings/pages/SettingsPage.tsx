import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import DownOutlined from "@ant-design/icons/DownOutlined";
import { App } from 'antd';
import Button from "antd/es/button";
import Radio from "antd/es/radio";
import Select from "antd/es/select";
import Slider from "antd/es/slider";
import Tag from "antd/es/tag";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { beanEditableDetailQueryKeys, beanQueryKeys } from '@/modules/bean/hooks';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { roastBatchQueryKeys, roastPlanQueryKeys } from '@/modules/roast/hooks';
import { cardDisplayModules } from '@/modules/settings/constants/cardDisplayModules';
import { useAppDisplaySettings, usePocketBaseConnectionSettings } from '@/modules/settings/hooks';
import { appDisplaySettingsSyncService } from '@/modules/settings/services/appDisplaySettingsSync.service';
import {
  loadQrCodeAsset,
  loadQrCodeFallbackAsset,
  type QrCodeKey,
} from '@/modules/settings/services/qrCodeAsset.service';
import {
  appDisplayScaleMax,
  appDisplayScaleMin,
  appDisplayScaleStep,
  type AppCardModuleKey,
  type AppDisplaySettings,
  type AppThemeMode,
} from '@/modules/settings/types';
import { useAppBuildVersion } from '@/app/hooks/useAppBuildVersion';
import { LegalFooter } from '@/modules/legal/components';
import { RoastedBeanConnectionCard } from '@/modules/settings/components/RoastedBeanConnectionCard';

import styles from './SettingsPage.module.css';

const qrCodeEntries: Record<
  QrCodeKey,
  {
    alt: string;
    buttonLabel: string;
  }
> = {
  author: {
    alt: '作者交流二维码',
    buttonLabel: '和作者交流一下',
  },
  sponsor: {
    alt: '赞助支持二维码',
    buttonLabel: '请作者喝杯咖啡',
  },
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
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const appBuildVersion = useAppBuildVersion();
  const {
    appDisplaySettings,
    loadAppDisplaySettings,
    saveAppDisplaySettings,
  } = useAppDisplaySettings();
  const { loadPocketBaseConnections, pocketBaseConnections } = usePocketBaseConnectionSettings();
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const lastGreenBeanRefreshSignatureRef = useRef('');
  const [visibleCode, setVisibleCode] = useState<null | QrCodeKey>(null);
  const [qrCodeFallbackTried, setQrCodeFallbackTried] = useState<Partial<Record<QrCodeKey, boolean>>>({});
  const [qrCodeLoadErrors, setQrCodeLoadErrors] = useState<Partial<Record<QrCodeKey, string>>>({});
  const [qrCodeSources, setQrCodeSources] = useState<Partial<Record<QrCodeKey, string>>>({});
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState(() => {
    const collapsedByDefault = import.meta.env.MODE !== 'test';

    return {
      displayScale: collapsedByDefault,
    };
  });
  const refreshGreenBeanDependencies = useCallback((connectionSignature: string) => {
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
    void loadPocketBaseConnections();
  }, [loadAppDisplaySettings, loadPocketBaseConnections]);

  useEffect(() => {
    const projectUrl = pocketBaseConnections.greenBean.projectUrl.trim();

    if (projectUrl.length === 0) {
      return;
    }

    const signature = JSON.stringify({ projectUrl });

    refreshGreenBeanDependencies(signature);
  }, [
    refreshGreenBeanDependencies,
    pocketBaseConnections.greenBean.projectUrl,
  ]);

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

  const loadQrCode = (code: QrCodeKey) => {
    if (qrCodeSources[code]) {
      return;
    }

    setQrCodeLoadErrors((current) => ({
      ...current,
      [code]: undefined,
    }));
    setQrCodeFallbackTried((current) => ({
      ...current,
      [code]: false,
    }));

    void loadQrCodeAsset(code)
      .then((module) => {
        setQrCodeSources((current) => ({
          ...current,
          [code]: module.default,
        }));
      })
      .catch(() => {
        setQrCodeLoadErrors((current) => ({
          ...current,
          [code]: '二维码加载失败，请重试。',
        }));
      });
  };

  const handleQrCodeImageError = (code: QrCodeKey) => {
    if (qrCodeFallbackTried[code]) {
      setQrCodeLoadErrors((current) => ({
        ...current,
        [code]: '二维码加载失败，请重试。',
      }));
      return;
    }

    setQrCodeFallbackTried((current) => ({
      ...current,
      [code]: true,
    }));

    void loadQrCodeFallbackAsset(code)
      .then((module) => {
        setQrCodeSources((current) => ({
          ...current,
          [code]: module.default,
        }));
      })
      .catch(() => {
        setQrCodeLoadErrors((current) => ({
          ...current,
          [code]: '二维码加载失败，请重试。',
        }));
      });
  };

  const handleToggleCode = (code: QrCodeKey) => {
    if (visibleCode === code) {
      setVisibleCode(null);
      return;
    }

    setVisibleCode(code);
    loadQrCode(code);
  };

  const activeQrEntry = visibleCode ? qrCodeEntries[visibleCode] : null;
  const activeQrCodeError = visibleCode ? qrCodeLoadErrors[visibleCode] : undefined;
  const activeQrCodeSource = visibleCode ? qrCodeSources[visibleCode] : undefined;

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

  const handleDeleteAccount = () => {
    let remainingSeconds = 5;
    let countdownTimer: number | null = null;

    const clearCountdown = () => {
      if (countdownTimer != null) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
      }
    };

    const modalInstance = modal.confirm({
      cancelText: '取消',
      centered: true,
      content:
        '你的账号、烘焙业务数据、财务记录、库存设置和关联配置都会被永久删除，且无法恢复。请确认你已经完成导出或备份。',
      maskClosable: false,
      okButtonProps: {
        danger: true,
        disabled: true,
      },
      okText: `确认注销（${String(remainingSeconds)}s）`,
      onCancel: () => {
        clearCountdown();
      },
      onOk: async () => {
        clearCountdown();
        setIsDeletingAccount(true);

        try {
          await deleteAccount();
          queryClient.clear();
          void message.success('账号已注销，所有关联数据已删除。');
        } catch (error) {
          void message.error(getUserFacingErrorMessage(error, '账号注销失败，请稍后重试。'));
        } finally {
          setIsDeletingAccount(false);
        }
      },
      title: '确认注销账号？',
    });

    countdownTimer = window.setInterval(() => {
      remainingSeconds -= 1;

      if (remainingSeconds <= 0) {
        clearCountdown();
        modalInstance.update({
          okButtonProps: {
            danger: true,
            disabled: false,
          },
          okText: '确认注销',
        });
        return;
      }

      modalInstance.update({
        okButtonProps: {
          danger: true,
          disabled: true,
        },
        okText: `确认注销（${String(remainingSeconds)}s）`,
      });
    }, 1000);
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
                    {activeQrCodeSource ? (
                      <img
                        alt={activeQrEntry.alt}
                        className={styles.qrImage}
                        onError={() => {
                          if (visibleCode) {
                            handleQrCodeImageError(visibleCode);
                          }
                        }}
                        src={activeQrCodeSource}
                      />
                    ) : activeQrCodeError && visibleCode ? (
                      <div className={styles.qrLoadError} role="alert">
                        <span>{activeQrCodeError}</span>
                        <Button
                          onClick={() => {
                            loadQrCode(visibleCode);
                          }}
                          type="default"
                        >
                          重新加载二维码
                        </Button>
                      </div>
                    ) : (
                      <div aria-label="正在加载二维码" className={styles.qrLoading} role="status" />
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className={styles.footerStack}>
          <section className={styles.dangerSection}>
            <Button
              block
              danger
              icon={<DeleteOutlined />}
              loading={isDeletingAccount}
              onClick={handleDeleteAccount}
            >
              注销账号
            </Button>
          </section>

          <p className={styles.buildVersion}>
            当前 Web 上传版本：
            {appBuildVersion}
          </p>

          <LegalFooter />
        </div>
      </form>

    </main>
  );
}
