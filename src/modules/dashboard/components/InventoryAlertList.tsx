import { WarningOutlined } from '@ant-design/icons';
import { Progress, Tag } from 'antd';

import type { InventoryAlert } from '@/modules/dashboard/types';

import styles from './InventoryAlertList.module.css';

interface InventoryAlertListProps {
  alerts: InventoryAlert[];
}

export function InventoryAlertList({ alerts }: InventoryAlertListProps) {
  return (
    <div className={styles.list}>
      {alerts.map((alert) => {
        const percent = Math.min(Math.round((alert.currentKg / alert.safetyKg) * 100), 100);

        return (
          <article className={styles.item} data-level={alert.level} key={alert.id}>
            <div className={styles.itemHeader}>
              <span>
                <WarningOutlined />
                {alert.beanName}
              </span>
              <Tag color={alert.level === 'critical' ? 'red' : 'orange'}>
                {alert.level === 'critical' ? '紧急' : '关注'}
              </Tag>
            </div>
            <Progress
              percent={percent}
              showInfo={false}
              size="small"
              status={alert.level === 'critical' ? 'exception' : 'active'}
            />
            <div className={styles.meta}>
              <span>当前 {alert.currentKg} kg</span>
              <span>安全线 {alert.safetyKg} kg</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

