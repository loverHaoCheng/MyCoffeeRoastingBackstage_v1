import CloseOutlined from '@ant-design/icons/CloseOutlined';
import MenuOutlined from '@ant-design/icons/MenuOutlined';
import Button from 'antd/es/button';

import type { ViewportFloatingActionButtonProps } from '@/shared/components/ViewportFloatingActionButton.context';

import styles from '../MainLayout.module.css';

interface MobileAppHeaderProps {
  actionConfig: null | ViewportFloatingActionButtonProps;
  isSettingsOpen: boolean;
  onBrandClick: () => void;
  onLeftButtonClick: () => void;
}

export function MobileAppHeader({
  actionConfig,
  isSettingsOpen,
  onBrandClick,
  onLeftButtonClick,
}: MobileAppHeaderProps) {
  return (
    <header className={styles.mobileHeader} data-app-shell-header="true">
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
      {actionConfig ? (
        <Button
          aria-label={actionConfig.ariaLabel}
          className={styles.mobileHeaderAction}
          icon={actionConfig.icon}
          onClick={actionConfig.onClick}
          shape="circle"
          type="text"
        />
      ) : (
        <span aria-hidden="true" className={styles.mobileHeaderSpacer} />
      )}
    </header>
  );
}
