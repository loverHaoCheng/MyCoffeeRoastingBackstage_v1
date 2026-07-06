import { useVisibleCardMetaItems } from '@/modules/settings/hooks';
import { UnifiedDataCard } from '@/shared/components/UnifiedDataCard';
import type { Bean } from '@/types/domain';
import type { FieldPath } from 'react-hook-form';

import type { GreenBeanFormInput } from '../types/localGreenBean';

interface BeanInventoryCardProps {
  bean: Bean;
  onDelete?: () => void;
  onEdit?: (beanId: Bean['id'], fieldPath?: FieldPath<GreenBeanFormInput>) => void;
  onView?: (beanId: Bean['id']) => void;
}

const formatKg = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
});

const formatCurrency = new Intl.NumberFormat('zh-CN', {
  currency: 'CNY',
  maximumFractionDigits: 0,
  style: 'currency',
});

const normalizeText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const getText = (fallback: string, value: unknown): string => {
  const normalized = normalizeText(value);

  return normalized.length > 0 ? normalized : fallback;
};

const beanCardEditFieldPathMap: Record<string, FieldPath<GreenBeanFormInput> | undefined> = {
  code: 'code',
  cost: 'purchasedTotalPrice',
  defaultRoastInput: 'defaultRoastInputGrams',
  defaultSaleUnitPrice: 'defaultSaleUnitPrice',
  defaultSaleUnitWeight: 'defaultSaleUnitWeightGrams',
  harvestSeason: 'harvestSeason',
  origin: 'originCountry',
  process: 'processMethod',
  stock: 'remainingWeightGrams',
  supplier: 'supplierName',
  grade: 'grade',
  variety: 'variety',
};

export function BeanInventoryCard({ bean, onDelete, onEdit, onView }: BeanInventoryCardProps) {
  const supplierName = normalizeText(bean.supplierName);
  const supplierText = supplierName
    ? supplierName
      : bean.supplierId != null
        ? `#${String(bean.supplierId)}`
        : '待配置';
  const allMetaItems = [
    { key: 'stock', label: '库存', value: `${formatKg.format(bean.stockKg)} kg` },
    { key: 'cost', label: '成本', value: `${formatCurrency.format(bean.costPerKg)} / kg` },
    { key: 'supplier', label: '供应商', value: supplierText, multiline: true },
    { key: 'process', label: '处理法', value: getText('待补充', bean.process) },
    { key: 'origin', label: '产地', value: getText('待补充', bean.origin), multiline: true },
    { key: 'variety', label: '品种', value: getText('待补充', bean.variety) },
    { key: 'grade', label: '等级', value: getText('待补充', bean.grade) },
    { key: 'harvestSeason', label: '产季', value: getText('待补充', bean.harvestSeason) },
    { key: 'code', label: '编号', value: getText('待补充', bean.code) },
    {
      key: 'defaultRoastInput',
      label: '默认烘焙量',
      value: bean.defaultRoastInputGrams != null ? `${String(bean.defaultRoastInputGrams)} g` : '待补充',
    },
    {
      key: 'defaultSaleUnitPrice',
      label: '默认单份售价',
      value: bean.defaultSaleUnitPrice != null ? formatCurrency.format(bean.defaultSaleUnitPrice) : '待补充',
    },
    {
      key: 'defaultSaleUnitWeight',
      label: '默认单份重量',
      value:
        bean.defaultSaleUnitWeightGrams != null ? `${String(bean.defaultSaleUnitWeightGrams)} g` : '待补充',
    },
  ];
  const previewMetaItems = useVisibleCardMetaItems('beanInventory', allMetaItems);
  const subtitle = bean.code?.trim() ? `编号 ${bean.code.trim()}` : `编号 ${String(bean.id)}`;

  return (
    <UnifiedDataCard
      deleteLabel={`删除 ${bean.name}`}
      metaItems={allMetaItems.map((item) => ({
        ...item,
        editLabel: `修改 ${item.label}`,
        onEdit:
          onEdit && beanCardEditFieldPathMap[item.key]
            ? () => {
                onEdit(bean.id, beanCardEditFieldPathMap[item.key]);
              }
            : undefined,
      }))}
      onDelete={onDelete}
      onView={
        onView
          ? () => {
              onView(bean.id);
            }
          : undefined
      }
      previewMetaItems={previewMetaItems.map((item) => ({
        ...item,
        editLabel: `修改 ${item.label}`,
        onEdit:
          onEdit && beanCardEditFieldPathMap[item.key]
            ? () => {
                onEdit(bean.id, beanCardEditFieldPathMap[item.key]);
              }
            : undefined,
      }))}
      subtitle={subtitle}
      title={bean.name}
    />
  );
}
