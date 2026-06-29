import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import dayjs from 'dayjs';

import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import { UnifiedDataCard } from '@/shared/components/UnifiedDataCard';

interface RoastBatchCardProps {
  batch: RoastBatchRecord;
  onDelete?: (batch: RoastBatchRecord) => void;
  onEdit?: (batchId: string) => void;
  onView?: (batchId: string) => void;
}

const getRoastLevelColor = (level: string): string => {
  const map: Record<string, string> = {
    '极浅': 'blue',
    '浅焙': 'cyan',
    '肉桂': 'green',
    '中浅': 'lime',
    '中焙': 'gold',
    '中深': 'orange',
    '深焙': 'red',
    '极深': 'volcano',
  };
  return map[level] || 'default';
};

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
    batch.developmentRatio !== undefined
      ? { key: 'developmentRatio', label: '发展比', value: `${String(batch.developmentRatio)}%` }
      : { key: 'status', label: '状态', value: batch.status === 'completed' ? '已完成' : '草稿' },
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
      bodyFooter={batch.roastPlanName ? (
        <Tag color={getRoastLevelColor(batch.roastLevel)}>计划：{batch.roastPlanName}</Tag>
      ) : undefined}
      deleteLabel={`删除 ${displayName}`}
      description={`${formattedDate} · ${batch.roastLevel}`}
      metaItems={metaItems}
      onDelete={onDelete ? () => onDelete(batch) : undefined}
      title={displayName}
    />
  );
}
