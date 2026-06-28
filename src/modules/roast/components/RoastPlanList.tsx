import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import { Button } from 'antd';

import type { RoastPlan } from '@/types/domain';

import styles from './RoastPlanList.module.css';

interface RoastPlanListProps {
  onEdit: (planId: number) => void;
  onView: (planId: number) => void;
  plans: RoastPlan[];
}

export function RoastPlanList({ plans, onEdit, onView }: RoastPlanListProps) {
  return (
    <div className={styles.list} aria-label="烘焙计划列表">
      {plans.map((plan) => {
        const metaItems = [plan.beanName, `${String(plan.batchWeightGrams)}g`, plan.targetRoastLevel].filter(
          Boolean,
        );

        return (
          <article className={styles.item} key={plan.id}>
            <div className={styles.itemBody}>
              <strong>{plan.name}</strong>
              <span>{metaItems.join(' · ')}</span>
            </div>
            <div className={styles.itemFooter}>
              <Button
                aria-label={`查看 ${plan.name}`}
                className={styles.cardAction}
                icon={<EyeOutlined />}
                onClick={() => {
                  onView(plan.id);
                }}
                size="small"
              >
                查看
              </Button>
              <Button
                aria-label={`编辑 ${plan.name}`}
                className={styles.cardAction}
                icon={<EditOutlined />}
                onClick={() => {
                  onEdit(plan.id);
                }}
                size="small"
              >
                编辑
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
