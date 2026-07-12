import DownOutlined from '@ant-design/icons/DownOutlined';
import { App } from 'antd';
import Button from 'antd/es/button';
import Radio from 'antd/es/radio';
import Select from 'antd/es/select';
import Slider from 'antd/es/slider';
import Tag from 'antd/es/tag';
import { useCallback, useEffect, useState } from 'react';

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

import styles from '../pages/SettingsPage.module.css';

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
  const nextKeys = Array.from(new Set(selectedKeys.filter((key) => defaultKeys.includes(key)))).slice(0, displayCount);

  while (nextKeys.length < displayCount) {
    const fallbackKey = defaultKeys.find((key) => !nextKeys.includes(key));

    if (!fallbackKey) {
      break;
    }

    nextKeys.push(fallbackKey);
  }

  return nextKeys;
};

export function AppearanceSettingsSection() {
  const { message } = App.useApp();
  const { appDisplaySettings, loadAppDisplaySettings, saveAppDisplaySettings } = useAppDisplaySettings();
  const [isCollapsed, setIsCollapsed] = useState(() => import.meta.env.MODE !== 'test');

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

  const handleCardVisibleMetaKeyChange = (moduleKey: AppCardModuleKey, slotIndex: number, selectedKey: string) => {
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

  return (
    <section className={styles.section} data-collapsed={isCollapsed}>
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
            aria-label={isCollapsed ? '展开' : '收起'}
            className={styles.collapseButton}
            data-expanded={!isCollapsed}
            icon={<DownOutlined />}
            onClick={() => { setIsCollapsed((current) => !current); }}
            type="text"
          />
        </div>
      </header>
      <div aria-hidden={isCollapsed} className={styles.sectionCollapse} data-collapsed={isCollapsed}>
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
                <p>每个模块都可以选择 0 / 2 / 4 项信息，并按位置指定展示内容。</p>
              </div>
              <Tag color="default">共 {cardDisplayModules.length} 个模块</Tag>
            </div>
            <div className={styles.cardDisplayGrid}>
              {cardDisplayModules.map((module) => {
                const moduleSettings = appDisplaySettings.cardDisplaySettings[module.key];
                const visibleSlots = Array.from({ length: moduleSettings.displayCount }, (_, index) => index);

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
                      onChange={(event) => { handleCardDisplayCountChange(module.key, event.target.value as 0 | 2 | 4); }}
                      optionType="button"
                      options={cardDisplayCountOptions}
                      value={moduleSettings.displayCount}
                    />
                    {visibleSlots.length > 0 ? (
                      <div className={styles.cardDisplaySlotGrid}>
                        {visibleSlots.map((slotIndex) => {
                          const currentValue = moduleSettings.visibleMetaKeys[slotIndex];

                          return (
                            <div className={styles.cardDisplaySlot} key={slotIndex}>
                              <span className={styles.cardDisplaySlotLabel}>第 {slotIndex + 1} 项</span>
                              <Select
                                aria-label={`第 ${String(slotIndex + 1)} 项卡片信息选择`}
                                className={styles.cardDisplaySelect}
                                onChange={(value) => { handleCardVisibleMetaKeyChange(module.key, slotIndex, value); }}
                                options={module.metaOptions.map((option) => ({
                                  disabled: option.key !== currentValue && moduleSettings.visibleMetaKeys.some(
                                    (selectedKey, selectedIndex) => selectedIndex !== slotIndex && selectedKey === option.key,
                                  ),
                                  label: option.label,
                                  value: option.key,
                                }))}
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
  );
}
