import { EditOutlined, EyeOutlined } from '@ant-design/icons';

import { UnifiedDataCard } from '@/shared/components/UnifiedDataCard';
import type { Bean } from '@/types/domain';

interface BeanInventoryCardProps {
  bean: Bean;
  onDelete?: () => void;
  onEdit?: (beanId: Bean['id']) => void;
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

export function BeanInventoryCard({ bean, onDelete, onEdit, onView }: BeanInventoryCardProps) {
  const supplierText = bean.supplierName?.trim()
    ? bean.supplierName
      : bean.supplierId != null
        ? `#${String(bean.supplierId)}`
        : '待配置';
  const descriptionText = [bean.variety?.trim(), bean.process?.trim()].filter(Boolean).join(' · ');

  const metaItems = [
    { key: 'stock', label: '库存', value: `${formatKg.format(bean.stockKg)} kg` },
    { key: 'cost', label: '成本', value: `${formatCurrency.format(bean.costPerKg)} / kg` },
    { key: 'supplier', label: '供应商', value: supplierText, multiline: true },
    { key: 'process', label: '处理法', value: bean.process?.trim() || '待补充' },
  ];

  return (
    <UnifiedDataCard
      actions={[
        {
          key: 'view',
          label: '查看',
          icon: <EyeOutlined />,
          ariaLabel: `查看 ${bean.name}`,
          onClick: () => onView?.(bean.id),
        },
        {
          key: 'edit',
          label: '编辑',
          icon: <EditOutlined />,
          ariaLabel: `编辑 ${bean.name}`,
          onClick: () => onEdit?.(bean.id),
        },
      ]}
      deleteLabel={`删除 ${bean.name}`}
      description={descriptionText}
      metaItems={metaItems}
      onDelete={onDelete}
      title={bean.name}
    />
  );
}
