import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import { UnifiedDataCard } from '@/shared/components/UnifiedDataCard';

interface RoastBatchCardProps {
  batch: RoastBatchRecord;
  onDelete?: (batch: RoastBatchRecord) => void;
  onEdit?: (batchId: string) => void;
  onView?: (batchId: string) => void;
}

export function RoastBatchCard({ batch, onDelete, onEdit, onView }: RoastBatchCardProps) {
  const displayName = batch.roastedBeanName || batch.greenBeanName;
  const lossRate = batch.inputWeightGrams > 0
    ? (((batch.inputWeightGrams - batch.outputWeightGrams) / batch.inputWeightGrams) * 100).toFixed(1)
    : '-';

  const roastDate = dayjs(batch.roastDate);
  const formattedDate = roastDate.isValid() ? roastDate.format('YYYY/MM/DD HH:mm') : batch.roastDate;
  const metaItems = [
    { key: 'inputWeight', label: '入豆量', value: `${String(batch.inputWeightGrams)} g` },
    { key: 'outputWeight', label: '出豆量', value: `${String(batch.outputWeightGrams)} g` },
    { key: 'lossRate', label: '失水率', value: `${lossRate}%` },
    { key: 'roastPlan', label: '烘焙计划', value: batch.roastPlanName?.trim() || '未关联' },
  ];

  return (
    <UnifiedDataCard
      actions={[
        {
          key: 'view',
          label: '查看',
          icon: <EyeOutlined />,
          ariaLabel: `查看 ${displayName}`,
          onClick: () => onView?.(batch.id),
        },
        {
          key: 'edit',
          label: '编辑',
          icon: <EditOutlined />,
          ariaLabel: `编辑 ${displayName}`,
          onClick: () => onEdit?.(batch.id),
        },
      ]}
      deleteLabel={`删除 ${displayName}`}
      description={`${formattedDate} · ${batch.roastLevel}`}
      metaItems={metaItems}
      onDelete={onDelete ? () => onDelete(batch) : undefined}
      title={displayName}
    />
  );
}
