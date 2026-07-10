import { useVisibleCardMetaItems } from '@/modules/settings/hooks';
import { roastPlanStatusLabelMap } from '@/modules/roast/constants/roastPlanStatus';
import { UnifiedDataCard } from '@/shared/components/UnifiedDataCard';
import { ResponsiveMasonry } from '@/shared/components/ResponsiveMasonry';
import type { RoastPlan } from '@/types/domain';

import type { RoastPlanEditableFieldPath } from './RoastPlanFieldEditorDrawer';

import styles from './RoastPlanList.module.css';

interface RoastPlanListProps {
  onDelete?: (plan: RoastPlan) => void;
  onEdit: (planId: RoastPlan['id'], fieldPath?: RoastPlanEditableFieldPath | 'steps') => void;
  onEditAll?: (planId: RoastPlan['id']) => void;
  onView: (planId: RoastPlan['id']) => void;
  plans: RoastPlan[];
}

const formatKg = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 2,
});

const normalizeText = (value: string | null | undefined): string => value?.trim() ?? '';

const getText = (fallback: string, value: string | null | undefined): string => {
  const normalized = normalizeText(value);

  return normalized.length > 0 ? normalized : fallback;
};

interface RoastPlanCardProps {
  onDelete?: (plan: RoastPlan) => void;
  onEdit: (planId: RoastPlan['id'], fieldPath?: RoastPlanEditableFieldPath | 'steps') => void;
  onEditAll?: (planId: RoastPlan['id']) => void;
  onView: (planId: RoastPlan['id']) => void;
  plan: RoastPlan;
}

function RoastPlanCard({ onDelete, onEdit, onEditAll, onView, plan }: RoastPlanCardProps) {
  const totalTimeLabel = getText('-', plan.steps[plan.steps.length - 1]?.timeLabel);
  const allMetaItems = [
    { key: 'beanName', label: '生豆', value: getText('待配置', plan.beanName), multiline: true, editPath: 'beanId' as const },
    { key: 'batchWeight', label: '批次重量', value: `${String(plan.batchWeightGrams)} g`, editPath: 'batchWeightGrams' as const },
    { key: 'plannedBatchWeight', label: '计划重量', value: `${formatKg.format(plan.plannedBatchKg)} kg` },
    { key: 'roastPurpose', label: '用途', value: getText('待补充', plan.roastPurpose), multiline: true, editPath: 'purpose' as const },
    { key: 'roastLevel', label: '烘焙度', value: getText('-', plan.targetRoastLevel), editPath: 'roastLevel' as const },
    { key: 'status', label: '状态', value: roastPlanStatusLabelMap[plan.status] },
    { key: 'stepCount', label: '节点数', value: `${String(plan.steps.length)} 个节点`, editPath: 'steps' as const },
  ];
  const previewMetaItems = useVisibleCardMetaItems('roastPlan', allMetaItems);

  return (
    <UnifiedDataCard
      deleteLabel={`删除 ${plan.name}`}
      metaItems={allMetaItems.map((item) => {
        const { editPath, ...metaItem } = item;

        return {
          ...metaItem,
          editLabel: `修改 ${item.label}`,
          onEdit: editPath
            ? () => {
                onEdit(plan.id, editPath);
              }
            : undefined,
        };
      })}
      onDelete={
        onDelete
          ? () => {
              onDelete(plan);
            }
          : undefined
      }
      onEditAll={
        onEditAll
          ? () => {
              onEditAll(plan.id);
            }
          : undefined
      }
      onView={() => {
        onView(plan.id);
      }}
      previewMetaItems={previewMetaItems.map((item) => {
        const editPath = allMetaItems.find((metaItem) => metaItem.key === item.key)?.editPath;

        return {
          ...item,
          editLabel: `修改 ${item.label}`,
          onEdit: editPath
            ? () => {
                onEdit(plan.id, editPath);
              }
            : undefined,
        };
      })}
      editAllLabel={`全部编辑 ${plan.name}`}
      subtitle={`总时间 ${totalTimeLabel}`}
      title={plan.name}
    />
  );
}

export function RoastPlanList({ plans, onDelete, onEdit, onEditAll, onView }: RoastPlanListProps) {
  return (
    <ResponsiveMasonry ariaLabel="烘焙计划列表" className={styles.list}>
      {plans.map((plan) => (
        <RoastPlanCard
          key={plan.id}
          onDelete={onDelete}
          onEdit={onEdit}
          onEditAll={onEditAll}
          onView={onView}
          plan={plan}
        />
      ))}
    </ResponsiveMasonry>
  );
}
