import { FlavorTagChips } from '@/modules/bean/components/FlavorTagChips';
import { useCostTemplateSettings, useVisibleCardMetaItems } from '@/modules/settings/hooks';
import { UnifiedDataCard } from '@/shared/components/UnifiedDataCard';
import type { Bean } from '@/types/domain';
import type { FieldPath } from 'react-hook-form';

import type { GreenBeanFormInput } from '../types/localGreenBean';

interface BeanInventoryCardProps {
  bean: Bean;
  onDelete?: () => void;
  onEdit?: (beanId: Bean['id'], fieldPath?: FieldPath<GreenBeanFormInput>) => void;
  onEditAll?: (beanId: Bean['id']) => void;
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

const formatGrams = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 0,
});

const formatOptionalText = (value: unknown, fallback = '待补充'): string => {
  const normalized = normalizeText(value);

  return normalized.length > 0 ? normalized : fallback;
};

const formatOptionalGrams = (value: unknown, fallback = '待补充'): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return `${formatGrams.format(Math.round(value))} g`;
};

const formatOptionalCurrency = (value: unknown, fallback = '待补充'): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return formatCurrency.format(value);
};

const formatOptionalDecimal = (value: unknown, suffix = '', fallback = '待补充'): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return `${String(value)}${suffix}`;
};

const normalizeText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const beanCardEditFieldPathMap: Record<string, FieldPath<GreenBeanFormInput> | undefined> = {
  altitudeMetersMax: 'altitudeMetersMax',
  altitudeMetersMin: 'altitudeMetersMin',
  agingDays: 'agingDays',
  code: 'code',
  costTemplateId: 'costTemplateId',
  defaultRoastInput: 'defaultRoastInputGrams',
  defaultSaleUnitPrice: 'defaultSaleUnitPrice',
  defaultSaleUnitWeight: 'defaultSaleUnitWeightGrams',
  densityGPerL: 'densityGPerL',
  flavorTags: 'flavorTags',
  harvestSeason: 'harvestSeason',
  millName: 'millName',
  moisturePercent: 'moisturePercent',
  notes: 'notes',
  origin: 'originCountry',
  originArea: 'originArea',
  originCountry: 'originCountry',
  originRegion: 'originRegion',
  process: 'processMethod',
  purchasedTotalPrice: 'purchasedTotalPrice',
  purchasedWeight: 'purchasedWeightGrams',
  stock: 'remainingWeightGrams',
  supplier: 'supplierName',
  tastingEndDays: 'tastingEndDays',
  grade: 'grade',
  variety: 'variety',
};

export function BeanInventoryCard({ bean, onDelete, onEdit, onEditAll, onView }: BeanInventoryCardProps) {
  const { costTemplateSettings } = useCostTemplateSettings();
  const isLocalDraftBean = String(bean.id).startsWith('local-');
  const supplierName = normalizeText(bean.supplierName);
  const supplierText = supplierName
    ? supplierName
    : bean.supplierId != null
      ? `#${String(bean.supplierId)}`
      : '待配置';
  const costTemplateText = bean.costTemplateId
    ? costTemplateSettings.templates.find((template) => template.id === bean.costTemplateId)?.name ??
      bean.costTemplateId
    : '待配置';
  const allMetaItems = [
    { key: 'stock', label: '库存', value: `${formatKg.format(bean.stockKg)} kg` },
    { key: 'cost', label: '成本', value: `${formatCurrency.format(bean.costPerKg)} / kg` },
    { key: 'costTemplateId', label: '成本模板', value: costTemplateText },
    { key: 'supplier', label: '供应商', value: supplierText, multiline: true },
    { key: 'process', label: '处理法', value: formatOptionalText(bean.process) },
    {
      key: 'flavorTags',
      label: '风味',
      value: <FlavorTagChips maxVisible={3} tags={bean.flavorTags} />,
      multiline: true,
    },
    { key: 'originCountry', label: '国家', value: formatOptionalText(bean.originCountry) },
    { key: 'originRegion', label: '产区', value: formatOptionalText(bean.originRegion) },
    { key: 'originArea', label: '小产区', value: formatOptionalText(bean.originArea) },
    { key: 'millName', label: '处理厂', value: formatOptionalText(bean.millName) },
    { key: 'variety', label: '品种', value: formatOptionalText(bean.variety) },
    { key: 'grade', label: '等级', value: formatOptionalText(bean.grade) },
    { key: 'harvestSeason', label: '产季', value: formatOptionalText(bean.harvestSeason) },
    { key: 'agingDays', label: '养豆时间', value: formatOptionalDecimal(bean.agingDays, ' 天') },
    { key: 'tastingEndDays', label: '赏味结束期', value: formatOptionalDecimal(bean.tastingEndDays, ' 天') },
    { key: 'code', label: '编号', value: formatOptionalText(bean.code) },
    {
      key: 'defaultRoastInput',
      label: '默认烘焙量',
      value: formatOptionalGrams(bean.defaultRoastInputGrams),
    },
    {
      key: 'defaultSaleUnitPrice',
      label: '默认单份售价',
      value: formatOptionalCurrency(bean.defaultSaleUnitPrice),
    },
    {
      key: 'defaultSaleUnitWeight',
      label: '默认单份重量',
      value: formatOptionalGrams(bean.defaultSaleUnitWeightGrams),
    },
    {
      key: 'purchasedWeight',
      label: '采购总重',
      value: formatOptionalGrams(bean.purchasedWeightGrams),
    },
    {
      key: 'purchasedTotalPrice',
      label: '采购总价',
      value: formatOptionalCurrency(bean.purchasedTotalPrice),
    },
    {
      key: 'remainingWeight',
      label: '剩余重量',
      value: formatOptionalGrams(bean.remainingWeightGrams),
    },
    {
      key: 'altitudeMetersMin',
      label: '海拔下限',
      value: formatOptionalDecimal(bean.altitudeMetersMin, ' m'),
    },
    {
      key: 'altitudeMetersMax',
      label: '海拔上限',
      value: formatOptionalDecimal(bean.altitudeMetersMax, ' m'),
    },
    {
      key: 'moisturePercent',
      label: '含水率',
      value: formatOptionalDecimal(bean.moisturePercent, '%'),
    },
    {
      key: 'densityGPerL',
      label: '密度',
      value: formatOptionalDecimal(bean.densityGPerL, ' g/L'),
    },
    { key: 'notes', label: '备注', value: formatOptionalText(bean.notes), multiline: true },
  ];
  const configuredPreviewMetaItems = useVisibleCardMetaItems('beanInventory', allMetaItems);
  const previewMetaItems = isLocalDraftBean ? allMetaItems : configuredPreviewMetaItems;
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
      onEditAll={
        onEditAll
          ? () => {
              onEditAll(bean.id);
            }
          : undefined
      }
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
      editAllLabel={`全部编辑 ${bean.name}`}
    />
  );
}
