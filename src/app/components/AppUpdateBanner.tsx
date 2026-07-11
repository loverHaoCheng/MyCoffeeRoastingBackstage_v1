import Alert from 'antd/es/alert';
import Button from 'antd/es/button';

import { useAppUpdateNotice } from '@/app/hooks/useAppUpdateNotice';
import { FloatingTopNotice } from '@/shared/components/FloatingTopNotice';

import styles from './AppUpdateBanner.module.css';

export function AppUpdateBanner() {
  const { dismissNotice, notice, refreshToUpdate } = useAppUpdateNotice();

  if (!notice) {
    return null;
  }

  return (
    <FloatingTopNotice className={styles.banner} slot="primary">
      <Alert
        action={
          <div className={styles.actions}>
            <Button onClick={dismissNotice}>稍后</Button>
            <Button onClick={refreshToUpdate} type="primary">
              立即刷新
            </Button>
          </div>
        }
        description={notice.message}
        message={notice.type === 'available' ? '检测到新版本' : '应用已更新'}
        showIcon
        type="info"
      />
    </FloatingTopNotice>
  );
}
