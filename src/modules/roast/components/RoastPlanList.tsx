import { EditOutlined, EyeOutlined } from '@ant-design/icons';

import { UnifiedDataCard } from '@/shared/components/UnifiedDataCard';
import type { RoastPlan } from '@/types/domain';

import styles from './RoastPlanList.module.css';

interface RoastPlanListProps {
  onDelete?: (plan: RoastPlan) => void;
  onEdit: (planId: RoastPlan['id']) => void;
  onView: (planId: RoastPlan['id']) => void;
  plans: RoastPlan[];
}

const statusLabel: Record<RoastPlan['status'], string> = {
  draft: '草稿',
  inProgress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

export function RoastPlanList({ plans, onDelete, onEdit, onView }: RoastPlanListProps) {
  return (
    <div className={styles.list} aria-label="烘焙计划列表">
      {plans.map((plan) => (
        <UnifiedDataCard
          key={plan.id}
          actions={[
            {
              key: 'view',
              label: '查看',
              icon: <EyeOutlined />,
              ariaLabel: `查看 ${plan.name}`,
              onClick: () => onView(plan.id),
            },
            {
              key: 'edit',
              label: '编辑',
              icon: <EditOutlined />,
              ariaLabel: `编辑 ${plan.name}`,
              onClick: () => onEdit(plan.id),
            },
          ]}
          deleteLabel={`删除 ${plan.name}`}
          description={plan.roastPurpose}
          metaItems={[
            { key: 'beanName', label: '生豆', value: plan.beanName || '待配置', multiline: true },
            { key: 'batchWeight', label: '批次重量', value: plan.batchWeightGrams != null ? `${String(plan.batchWeightGrams)} g` : '-' },
            { key: 'roastLevel', label: '烘焙度', value: plan.targetRoastLevel || '-' },
            { key: 'status', label: '状态', value: statusLabel[plan.status] },
          ]}
          onDelete={onDelete ? () => onDelete(plan) : undefined}
          title={plan.name}
        />
      ))}
    </div>
  );
}
