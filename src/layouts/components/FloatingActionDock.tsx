import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import Button from 'antd/es/button';

import type { ViewportFloatingActionButtonProps } from '@/shared/components/ViewportFloatingActionButton.context';

import floatingActionStyles from '@/shared/components/ViewportFloatingActionButton.module.css';
import styles from './FloatingActionDock.module.css';

interface FloatingActionDockProps {
  isQuickRefreshing: boolean;
  isVisible: boolean;
  onRefresh: () => void;
  showRefreshAction: boolean;
  viewportAction: null | ViewportFloatingActionButtonProps;
}

export function FloatingActionDock({
  isQuickRefreshing,
  isVisible,
  onRefresh,
  showRefreshAction,
  viewportAction,
}: FloatingActionDockProps) {
  return (
    <div
      aria-hidden="true"
      className={styles.floatingActionRoot}
      data-visible={isVisible}
    >
      {showRefreshAction ? (
        <Button
          aria-label="快速刷新当前数据"
          className={floatingActionStyles.button}
          disabled={isQuickRefreshing}
          icon={<ReloadOutlined spin={isQuickRefreshing} />}
          onClick={onRefresh}
          shape="circle"
          type="default"
        />
      ) : null}
      {viewportAction ? (
        <Button
          aria-label={viewportAction.ariaLabel}
          className={floatingActionStyles.button}
          icon={viewportAction.icon}
          onClick={viewportAction.onClick}
          shape="circle"
          type="default"
        />
      ) : null}
    </div>
  );
}
