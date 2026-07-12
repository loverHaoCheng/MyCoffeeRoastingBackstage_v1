import Spin from 'antd/es/spin';
import { lazy, Suspense, type ReactNode, type RefObject } from 'react';

import styles from './MobileSettingsOverlay.module.css';

const MobileSettingsPage = lazy(() =>
  import('@/modules/settings').then((module) => ({ default: module.SettingsPage })),
);

interface MobileSettingsOverlayProps {
  authBar: ReactNode;
  isVisible: boolean;
  onClose: () => void;
  panelScrollRef: RefObject<HTMLDivElement | null>;
}

export function MobileSettingsOverlay({
  authBar,
  isVisible,
  onClose,
  panelScrollRef,
}: MobileSettingsOverlayProps) {
  return (
    <div
      aria-hidden={!isVisible}
      className={styles.mobileSettingsOverlay}
      data-visible={isVisible}
    >
      <button
        aria-label="关闭设置面板"
        className={styles.mobileSettingsBackdrop}
        onClick={onClose}
        type="button"
      />
      <aside className={styles.mobileSettingsPanel} data-visible={isVisible}>
        <div className={styles.mobileSettingsPanelScroll} ref={panelScrollRef}>
          {authBar}
          <Suspense
            fallback={
              <div className={styles.mobileSettingsLoading}>
                <Spin />
              </div>
            }
          >
            <MobileSettingsPage />
          </Suspense>
        </div>
      </aside>
    </div>
  );
}
