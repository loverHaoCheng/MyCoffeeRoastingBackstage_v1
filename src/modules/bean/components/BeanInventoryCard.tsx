import { Repeat2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FlavorTagChips } from '@/modules/bean/components/FlavorTagChips';
import { useCostTemplateSettings, useVisibleCardMetaItems } from '@/modules/settings/hooks';
import { UnifiedDataCard } from '@/shared/components/UnifiedDataCard';
import { Button } from '@/shared/components/ui/button';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/shared/components/ui/progress';
import type { Bean } from '@/types/domain';
import type { FieldPath } from 'react-hook-form';

import type { GreenBeanFormInput } from '../types/localGreenBean';

interface BeanInventoryCardProps {
  bean: Bean;
  onDelete?: () => void;
  onEdit?: (beanId: Bean['id'], fieldPath?: FieldPath<GreenBeanFormInput>) => void;
  onEditAll?: (beanId: Bean['id']) => void;
  onRestock?: (bean: Bean) => void;
  onView?: (beanId: Bean['id']) => void;
}

const formatKg = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
});

const formatCompactKg = (value: number): string => {
  return `${formatKg.format(value)}kg`;
};

const formatCurrency = new Intl.NumberFormat('zh-CN', {
  currency: 'CNY',
  maximumFractionDigits: 2,
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

export function BeanInventoryCard({ bean, onDelete, onEdit, onEditAll, onRestock, onView }: BeanInventoryCardProps) {
  const { costTemplateSettings } = useCostTemplateSettings();
  const isLocalDraftBean = String(bean.id).startsWith('local-');
  const isZeroStockBean = Math.max(0, Math.round(bean.remainingWeightGrams ?? bean.stockKg * 1000)) === 0;
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
  const canEditBean = !isZeroStockBean;
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
  const subtitle = `豆种 ${formatOptionalText(bean.variety)}`;
  const totalWeightGrams = Math.max(
    0,
    Math.round(bean.purchasedWeightGrams ?? bean.remainingWeightGrams ?? bean.stockKg * 1000),
  );
  const remainingWeightGrams = Math.min(
    totalWeightGrams,
    Math.max(0, Math.round(bean.remainingWeightGrams ?? bean.stockKg * 1000)),
  );
  const remainingRatio = totalWeightGrams > 0 ? (remainingWeightGrams / totalWeightGrams) * 100 : 0;
  const inventoryProgressSummary = (
    <Progress
      aria-label={`${bean.name} 剩余库存占比`}
      className="w-full"
      indicatorClassName="bg-[color-mix(in_srgb,var(--app-text-secondary)_52%,white)]"
      trackClassName="h-1.5 bg-[color-mix(in_srgb,var(--app-text-tertiary)_10%,white)]"
      value={remainingRatio}
    >
      <ProgressLabel className="truncate">
        {formatCompactKg(remainingWeightGrams / 1000)}/{formatCompactKg(totalWeightGrams / 1000)}
      </ProgressLabel>
      <ProgressValue />
    </Progress>
  );
  const inventoryProgressFooter = isZeroStockBean && onRestock ? (
    <div className="-mt-0.5 grid gap-0 bg-transparent">
      <div className="px-2 py-1">
        {inventoryProgressSummary}
      </div>
      <Separator className="w-full" />
      <Button
        aria-label={`立即续购 ${bean.name}`}
        className="h-9 w-full rounded-none rounded-b-[15px] border-0 bg-transparent px-3 text-[11px] font-medium text-[var(--app-text-secondary)] shadow-none transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--app-text)_4%,transparent)] hover:text-[var(--app-text)] active:bg-[color-mix(in_srgb,var(--app-text)_7%,transparent)]"
        onClick={() => {
          onRestock(bean);
        }}
        size="sm"
        variant="ghost"
      >
        <Repeat2 className="h-3.5 w-3.5" />
        续购
      </Button>
    </div>
  ) : inventoryProgressSummary;

  return (
    <UnifiedDataCard
      cardStyle={
        isZeroStockBean
          ? {
              boxShadow: 'inset 0 1px 0 var(--app-card-inset-highlight)',
            }
          : undefined
      }
      deleteLabel={`删除 ${bean.name}`}
      metaItems={allMetaItems.map((item) => ({
        ...item,
        editLabel: `修改 ${item.label}`,
        onEdit:
          canEditBean && onEdit && beanCardEditFieldPathMap[item.key]
            ? () => {
                onEdit(bean.id, beanCardEditFieldPathMap[item.key]);
              }
            : undefined,
      }))}
      onDelete={onDelete}
      onEditAll={
        !isZeroStockBean && onEditAll
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
          canEditBean && onEdit && beanCardEditFieldPathMap[item.key]
            ? () => {
                onEdit(bean.id, beanCardEditFieldPathMap[item.key]);
              }
            : undefined,
      }))}
      footer={inventoryProgressFooter}
      footerClassName={isZeroStockBean ? '-mx-3 -mb-2.5 rounded-none border-0 bg-transparent px-0 py-0 shadow-none' : 'border-0 bg-transparent px-0 py-0 shadow-none'}
      subtitle={subtitle}
      title={bean.name}
      editAllLabel={!isZeroStockBean ? `全部编辑 ${bean.name}` : undefined}
    />
  );
}
