import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import { normalizeRoastLevel } from '@/modules/roast/constants/roastLevel';
import { useVisibleCardMetaItems } from '@/modules/settings/hooks';
import { UnifiedDataCard } from '@/shared/components/UnifiedDataCard';

import type { RoastBatchEditableFieldPath } from './RoastBatchFieldEditorDrawer';

interface RoastBatchCardProps {
  batch: RoastBatchRecord;
  onDelete?: (batch: RoastBatchRecord) => void;
  onEdit?: (batchId: string, fieldPath?: RoastBatchEditableFieldPath) => void;
  onEditAll?: (batchId: string) => void;
  onView?: (batchId: string) => void;
}

const normalizeText = (value: string | null | undefined): string => value?.trim() ?? '';

const getText = (fallback: string, ...values: (string | null | undefined)[]): string => {
  for (const value of values) {
    const normalized = normalizeText(value);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return fallback;
};

export function RoastBatchCard({ batch, onDelete, onEdit, onEditAll, onView }: RoastBatchCardProps) {
  const displayName = getText('未命名烘焙记录', batch.roastedBeanName, batch.greenBeanName);
  const subtitleDate = new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(batch.roastDate));
  const lossRate =
    batch.inputWeightGrams > 0
      ? (((batch.inputWeightGrams - batch.outputWeightGrams) / batch.inputWeightGrams) * 100).toFixed(1)
      : '-';
  const allMetaItems = [
    { key: 'roastDate', label: '烘焙日期', value: new Date(batch.roastDate).toLocaleString('zh-CN'), editPath: 'roastDate' as const },
    { key: 'greenBean', label: '生豆', value: getText('待配置', batch.greenBeanName), multiline: true, editPath: 'greenBeanId' as const },
    {
      key: 'roastedBean',
      label: '熟豆',
      value: getText('待配置', batch.roastedBeanName, batch.greenBeanName),
      multiline: true,
      editPath: 'roastedBeanName' as const,
    },
    { key: 'salesMode', label: '去向', value: batch.salesMode === 'selfUse' ? '自留' : '销售', editPath: 'salesMode' as const },
    ...(batch.salesMode === 'sale'
      ? [{ key: 'soldUnitCount', label: '已售份数', value: `${String(batch.soldUnitCount ?? 1)} 份`, editPath: 'soldUnitCount' as const }]
      : []),
    { key: 'roastPlan', label: '烘焙计划', value: getText('未关联', batch.roastPlanName), multiline: true, editPath: 'roastPlanId' as const },
    { key: 'inputWeight', label: '入豆量', value: `${String(batch.inputWeightGrams)} g`, editPath: 'inputWeightGrams' as const },
    { key: 'outputWeight', label: '出豆量', value: `${String(batch.outputWeightGrams)} g`, editPath: 'outputWeightGrams' as const },
    { key: 'lossRate', label: '失水率', value: `${lossRate}%` },
    {
      key: 'roastLevel',
      label: '烘焙程度',
      value: getText('待补充', normalizeRoastLevel(batch.roastLevel)),
      editPath: 'roastLevel' as const,
    },
    {
      key: 'developmentRatio',
      label: '发展比',
      value: batch.developmentRatio != null ? `${batch.developmentRatio.toFixed(1)}%` : '-',
      editPath: 'developmentRatio' as const,
    },
    {
      key: 'firstCrackTime',
      label: '一爆时间',
      value: batch.firstCrackTime != null ? `${String(batch.firstCrackTime)} s` : '-',
      editPath: 'firstCrackTime' as const,
    },
    {
      key: 'totalRoastTime',
      label: '总烘焙时间',
      value: batch.totalRoastTime != null ? `${String(batch.totalRoastTime)} s` : '-',
      editPath: 'totalRoastTime' as const,
    },
    { key: 'notes', label: '备注', value: getText('无', batch.notes), multiline: true, editPath: 'notes' as const },
    { key: 'status', label: '状态', value: batch.status === 'completed' ? '已完成' : '草稿', editPath: 'status' as const },
  ];
  const previewMetaItems = useVisibleCardMetaItems('roastBatch', allMetaItems);

  return (
    <UnifiedDataCard
      deleteLabel={`删除 ${displayName}`}
      metaItems={allMetaItems.map((item) => {
        const { editPath, ...metaItem } = item;

        return {
          ...metaItem,
          editLabel: `修改 ${item.label}`,
          onEdit:
            onEdit && editPath
              ? () => {
                  onEdit(batch.id, editPath);
                }
              : undefined,
        };
      })}
      onDelete={
        onDelete
          ? () => {
              onDelete(batch);
            }
          : undefined
      }
      onEditAll={
        onEditAll
          ? () => {
              onEditAll(batch.id);
            }
          : undefined
      }
      onView={
        onView
          ? () => {
              onView(batch.id);
            }
          : undefined
      }
      previewMetaItems={previewMetaItems.map((item) => {
        const editPath = allMetaItems.find((metaItem) => metaItem.key === item.key)?.editPath;

        return {
          ...item,
          editLabel: `修改 ${item.label}`,
          onEdit:
            onEdit && editPath
              ? () => {
                  onEdit(batch.id, editPath);
                }
              : undefined,
        };
      })}
      editAllLabel={`全部编辑 ${displayName}`}
      subtitle={`日期 ${subtitleDate}`}
      title={displayName}
    />
  );
}
