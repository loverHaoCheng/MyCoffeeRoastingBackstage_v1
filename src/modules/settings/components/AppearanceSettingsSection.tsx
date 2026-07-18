import { App } from 'antd';
import Button from 'antd/es/button';
import Radio from 'antd/es/radio';
import Slider from 'antd/es/slider';
import Tag from 'antd/es/tag';
import { ChevronRight } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

import { cardDisplayModules } from '@/modules/settings/constants/cardDisplayModules';
import { useAppDisplaySettings } from '@/modules/settings/hooks';
import { appDisplaySettingsSyncService } from '@/modules/settings/services/appDisplaySettingsSync.service';
import {
  appDisplayScaleMax,
  appDisplayScaleMin,
  appDisplayScaleStep,
  type AppCardModuleKey,
  type AppDisplaySettings,
  type AppThemeMode,
} from '@/modules/settings/types';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/shared/components/ui/field';
import { Separator } from '@/components/ui/separator';

import styles from '../pages/SettingsPage.module.css';
import accordionStyles from './SettingsAccordionItem.module.css';

const cardDisplayCountOptions: { label: string; value: 0 | 2 | 4 }[] = [
  { label: '0 项', value: 0 },
  { label: '2 项', value: 2 },
  { label: '4 项', value: 4 },
];

const themeModeOptions: { label: string; value: AppThemeMode }[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
];

const formatPercentLabel = (value: number): string => `${String(Math.round(value * 100))}%`;

const getDefaultVisibleKeys = (moduleKey: AppCardModuleKey): string[] => {
  return cardDisplayModules.find((module) => module.key === moduleKey)?.metaOptions.map((item) => item.key) ?? [];
};

const normalizeCardDisplayMetaKeys = (
  moduleKey: AppCardModuleKey,
  selectedKeys: string[],
  displayCount: 0 | 2 | 4,
): string[] => {
  if (displayCount === 0) {
    return [];
  }

  const defaultKeys = getDefaultVisibleKeys(moduleKey);
  const nextKeys: string[] = [];

  for (let index = 0; index < displayCount; index += 1) {
    const key = selectedKeys[index];

    if (typeof key !== 'string' || !defaultKeys.includes(key) || nextKeys.includes(key)) {
      continue;
    }

    nextKeys.push(key);
  }

  while (nextKeys.length < displayCount) {
    const fallbackKey = defaultKeys.find((key) => !nextKeys.includes(key));

    if (!fallbackKey) {
      break;
    }

    nextKeys.push(fallbackKey);
  }

  return nextKeys;
};

const filterCardDisplayMetaKeys = (
  moduleKey: AppCardModuleKey,
  selectedKeys: string[],
  displayCount: 0 | 2 | 4,
): string[] => {
  if (displayCount === 0) {
    return [];
  }

  const allowedKeys = getDefaultVisibleKeys(moduleKey);

  return allowedKeys.filter((key) => selectedKeys.includes(key)).slice(0, displayCount);
};

export function AppearanceSettingsSection() {
  const { message } = App.useApp();
  const { appDisplaySettings, loadAppDisplaySettings, saveAppDisplaySettings } = useAppDisplaySettings();
  const [activeCardDisplayModuleKey, setActiveCardDisplayModuleKey] = useState<null | AppCardModuleKey>(null);

  useEffect(() => {
    loadAppDisplaySettings();
  }, [loadAppDisplaySettings]);

  const persistAppDisplaySettings = useCallback((nextSettings: AppDisplaySettings) => {
    const savedSettings = saveAppDisplaySettings(nextSettings);

    void appDisplaySettingsSyncService.syncSafely(savedSettings);

    return savedSettings;
  }, [saveAppDisplaySettings]);

  const handleDisplayScaleChange = (value: number) => {
    persistAppDisplaySettings({ ...appDisplaySettings, scale: Number(value.toFixed(2)) });
  };

  const handleThemeModeChange = (themeMode: AppThemeMode) => {
    persistAppDisplaySettings({ ...appDisplaySettings, themeMode });
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

  const handleCardVisibleMetaKeysChange = (moduleKey: AppCardModuleKey, selectedKeys: string[]) => {
    const moduleSettings = appDisplaySettings.cardDisplaySettings[moduleKey];

    persistAppDisplaySettings({
      ...appDisplaySettings,
      cardDisplaySettings: {
        ...appDisplaySettings.cardDisplaySettings,
        [moduleKey]: {
          ...moduleSettings,
          visibleMetaKeys: filterCardDisplayMetaKeys(
            moduleKey,
            selectedKeys,
            moduleSettings.displayCount,
          ),
        },
      },
    });
  };

  const activeCardDisplayModule = useMemo(() => {
    if (!activeCardDisplayModuleKey) {
      return null;
    }

    return cardDisplayModules.find((module) => module.key === activeCardDisplayModuleKey) ?? null;
  }, [activeCardDisplayModuleKey]);

  return (
    <>
      <AccordionItem as="section" className={accordionStyles.item} value="appearance">
        <AccordionTrigger
          className={accordionStyles.trigger}
          collapsedAriaLabel="展开"
          expandedAriaLabel="收起"
        >
          <div className={accordionStyles.triggerBody}>
            <div className={accordionStyles.triggerMain}>
              <div className={accordionStyles.titleGroup}>
                <h2 className={accordionStyles.title}>界面外观</h2>
                <Tag color={appDisplaySettings.themeMode === 'dark' ? 'default' : 'blue'}>
                  {appDisplaySettings.themeMode === 'dark' ? '深色' : '浅色'}
                </Tag>
                <Tag color="blue">{Math.round(appDisplaySettings.scale * 100)}%</Tag>
              </div>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className={accordionStyles.content}>
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
                onChange={(event) => { handleThemeModeChange(event.target.value as AppThemeMode); }}
                optionType="button"
                options={themeModeOptions}
                value={appDisplaySettings.themeMode}
              />
            </article>

            <article className={styles.appearanceBlock}>
              <div className={styles.appearanceBlockHeader}>
                <div>
                  <strong>显示缩放</strong>
                  <p>按需调整全局字体大小，不改变卡片尺寸、间距和抽屉布局，仅在本机生效。</p>
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
                  <Button onClick={() => { handleDisplayScaleChange(1); }}>恢复 100%</Button>
                  <Button onClick={() => { handleDisplayScaleChange(1); void message.success('显示缩放已恢复默认'); }}>
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
                <p>每个模块都可以选择最多 0 / 2 / 4 项信息，外部保留摘要，点击后在底部抽屉里调整字段。</p>
              </div>
              <Tag color="default">共 {cardDisplayModules.length} 个模块</Tag>
            </div>
            <div className={styles.cardDisplaySummaryList}>
              {cardDisplayModules.map((module) => {
                const moduleSettings = appDisplaySettings.cardDisplaySettings[module.key];
                const selectedLabels = module.metaOptions
                  .filter((option) => moduleSettings.visibleMetaKeys.includes(option.key))
                  .map((option) => option.label);
                const selectedSummary = moduleSettings.displayCount === 0
                  ? '当前不展示摘要字段'
                  : selectedLabels.length > 0
                    ? selectedLabels.join(' · ')
                    : '点击选择展示字段';

                return (
                  <Fragment key={module.key}>
                    <button
                      aria-label={`配置 ${module.label} 卡片字段`}
                      className={styles.cardDisplaySummaryRow}
                      onClick={() => {
                        setActiveCardDisplayModuleKey(module.key);
                      }}
                      type="button"
                    >
                      <div className={styles.cardDisplayModuleHeader}>
                        <div>
                          <strong>{module.label}</strong>
                          <p>{module.description}</p>
                        </div>
                        <div className={styles.cardDisplaySummaryMeta}>
                          <Tag>{moduleSettings.displayCount} 项</Tag>
                          <ChevronRight aria-hidden="true" className={styles.cardDisplaySummaryChevron} />
                        </div>
                      </div>
                      <p className={styles.cardDisplaySummaryText}>{selectedSummary}</p>
                    </button>
                    {module.key !== cardDisplayModules[cardDisplayModules.length - 1]?.key ? (
                      <Separator className={styles.cardDisplaySummarySeparator} />
                    ) : null}
                  </Fragment>
                );
              })}
            </div>
          </article>
        </AccordionContent>
      </AccordionItem>

      <AppDrawer
        destroyOnHidden
        height="78dvh"
        onClose={() => {
          setActiveCardDisplayModuleKey(null);
        }}
        open={activeCardDisplayModule != null}
        placement="bottom"
        styles={{
          body: {
            paddingLeft: '16px',
            paddingRight: '16px',
          },
        }}
        title={activeCardDisplayModule ? `${activeCardDisplayModule.label}卡片字段` : undefined}
      >
        {activeCardDisplayModule ? (() => {
          const moduleSettings = appDisplaySettings.cardDisplaySettings[activeCardDisplayModule.key];
          const selectedKeySet = new Set(moduleSettings.visibleMetaKeys);
          const reachedSelectionLimit =
            moduleSettings.displayCount > 0 && moduleSettings.visibleMetaKeys.length >= moduleSettings.displayCount;

          return (
            <section className={styles.cardDisplayDrawerContent}>
              <header className={styles.cardDisplayDrawerHeader}>
                <div>
                  <strong>{activeCardDisplayModule.label}</strong>
                  <p>{activeCardDisplayModule.description}</p>
                </div>
                <Tag>{moduleSettings.displayCount} 项</Tag>
              </header>

              <Radio.Group
                buttonStyle="solid"
                className={styles.cardDisplayCountGroup}
                onChange={(event) => { handleCardDisplayCountChange(activeCardDisplayModule.key, event.target.value as 0 | 2 | 4); }}
                optionType="button"
                options={cardDisplayCountOptions}
                value={moduleSettings.displayCount}
              />

              {moduleSettings.displayCount > 0 ? (
                <FieldSet className={styles.cardDisplayFieldSet}>
                  <FieldLegend variant="label">展示字段</FieldLegend>
                  <FieldDescription>
                    最多选择 {moduleSettings.displayCount} 项，已选择 {moduleSettings.visibleMetaKeys.length} 项。
                  </FieldDescription>
                  <FieldGroup className={styles.cardDisplayDrawerCheckboxGroup}>
                    {activeCardDisplayModule.metaOptions.map((option) => {
                      const checked = selectedKeySet.has(option.key);
                      const disabled = !checked && reachedSelectionLimit;

                      return (
                        <Field className={styles.cardDisplayCheckboxField} key={option.key} orientation="horizontal">
                          <Checkbox
                            aria-label={`${activeCardDisplayModule.label} ${option.label}`}
                            checked={checked}
                            disabled={disabled}
                            id={`${activeCardDisplayModule.key}-${option.key}`}
                            name={`${activeCardDisplayModule.key}-${option.key}`}
                            onChange={(event) => {
                              const nextSelectedKeys = event.target.checked
                                ? [...moduleSettings.visibleMetaKeys, option.key]
                                : moduleSettings.visibleMetaKeys.filter((key) => key !== option.key);

                              handleCardVisibleMetaKeysChange(activeCardDisplayModule.key, nextSelectedKeys);
                            }}
                          />
                          <FieldLabel className={styles.cardDisplayCheckboxLabel} htmlFor={`${activeCardDisplayModule.key}-${option.key}`}>
                            {option.label}
                          </FieldLabel>
                        </Field>
                      );
                    })}
                  </FieldGroup>
                </FieldSet>
              ) : (
                <p className={styles.cardDisplayEmptyState}>当前已设为 0 项，卡片不会显示摘要字段。</p>
              )}
            </section>
          );
        })() : null}
      </AppDrawer>
    </>
  );
}
