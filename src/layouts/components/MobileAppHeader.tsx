import CloseOutlined from '@ant-design/icons/CloseOutlined';
import MenuOutlined from '@ant-design/icons/MenuOutlined';
import Button from 'antd/es/button';

import type { ViewportFloatingActionButtonProps } from '@/shared/components/ViewportFloatingActionButton.context';

import styles from './MobileAppHeader.module.css';

interface MobileAppHeaderProps {
  actionConfigs: ViewportFloatingActionButtonProps[];
  isSettingsOpen: boolean;
  onBrandClick: () => void;
  onLeftButtonClick: () => void;
}

export function MobileAppHeader({
  actionConfigs,
  isSettingsOpen,
  onBrandClick,
  onLeftButtonClick,
}: MobileAppHeaderProps) {
  return (
    <header className={styles.mobileHeader}>
      <button
        aria-label={isSettingsOpen ? '收起设置面板' : '打开设置面板'}
        className={styles.mobileHeaderButton}
        onClick={onLeftButtonClick}
        type="button"
      >
        {isSettingsOpen ? <CloseOutlined /> : <MenuOutlined />}
      </button>
      <button className={styles.mobileBrand} onClick={onBrandClick} type="button">
        EasyBake
      </button>
      {actionConfigs.length > 0 ? (
        <div className={styles.mobileHeaderActions}>
          {actionConfigs.map((actionConfig) => (
            <Button
              aria-label={actionConfig.ariaLabel}
              className={styles.mobileHeaderAction}
              icon={actionConfig.icon}
              key={actionConfig.ariaLabel}
              onClick={actionConfig.onClick}
              shape="circle"
              type="text"
            />
          ))}
        </div>
      ) : (
        <span aria-hidden="true" className={styles.mobileHeaderSpacer} />
      )}
    </header>
  );
}
