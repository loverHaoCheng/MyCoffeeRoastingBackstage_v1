import type { ReadonlyFieldItem, ReadonlyFieldSection } from '@/shared/components/ReadonlyFieldSectionList';
import { formatShanghaiDateTime } from '@/shared/time/shanghaiTime';
import type { Bean } from '@/types/domain';

import type { GreenBeanEditableDetail } from '../../types/localGreenBean';
import { FlavorTagChips } from '../FlavorTagChips';

interface BuildBeanDetailSectionsInput {
  bean: Bean;
  costTemplateLabel: string | null;
  detail: GreenBeanEditableDetail | undefined;
}

const formatCurrency = new Intl.NumberFormat('zh-CN', {
  currency: 'CNY',
  maximumFractionDigits: 2,
  style: 'currency',
});

const createItem = (
  key: string,
  label: string,
  value: null | string | number | undefined,
  suffix = '',
): null | ReadonlyFieldItem => {
  if (value == null || value === '') {
    return null;
  }

  return { key, label, value: `${String(value)}${suffix}` };
};

const createCurrencyItem = (key: string, label: string, value: null | number | undefined): null | ReadonlyFieldItem => {
  if (value == null || value <= 0) {
    return null;
  }

  return { key, label, value: formatCurrency.format(value) };
};

const createSection = (key: string, title: string, items: (null | ReadonlyFieldItem)[]): ReadonlyFieldSection => ({
  items: items.filter((item): item is ReadonlyFieldItem => item != null),
  key,
  title,
});

export const buildBeanDetailSections = ({
  bean,
  costTemplateLabel,
  detail,
}: BuildBeanDetailSectionsInput): ReadonlyFieldSection[] => {
  const flavorTags = detail?.flavorTags ?? bean.flavorTags ?? [];
  const purchaseWeightGrams = detail?.purchasedWeightGrams ?? bean.purchasedWeightGrams;
  const remainingWeightGrams = detail?.remainingWeightGrams ?? bean.remainingWeightGrams;

  return [
    createSection('core', '基础信息', [
      createItem('name', '名称', detail?.displayName ?? bean.name),
      createItem('code', '编号', detail?.code ?? bean.code),
      createItem('grade', '等级', detail?.grade ?? bean.grade),
      createItem('process', '处理法', detail?.processMethod ?? bean.process),
      createItem('variety', '豆种', detail?.variety ?? bean.variety),
      createItem('harvestSeason', '产季', detail?.harvestSeason ?? bean.harvestSeason),
      createItem('millName', '处理厂', detail?.millName ?? bean.millName),
    ]),
    createSection('purchase', '采购与定价', [
      createItem('purchaseDate', '采购日期', detail?.purchaseDate ?? bean.purchaseDate),
      createItem('purchasedWeightGrams', '购买重量', purchaseWeightGrams, ' g'),
      createItem('remainingWeightGrams', '剩余重量', remainingWeightGrams, ' g'),
      createCurrencyItem('purchasedTotalPrice', '购买总价', detail?.purchasedTotalPrice ?? bean.purchasedTotalPrice),
      bean.costPerKg > 0 ? { key: 'costPerKg', label: '成本', value: `${formatCurrency.format(bean.costPerKg)} / kg` } : null,
      createItem('costTemplate', '成本模板', costTemplateLabel),
      createItem('defaultRoastInputGrams', '默认烘焙量', detail?.defaultRoastInputGrams ?? bean.defaultRoastInputGrams, ' g'),
      createItem('defaultSaleUnitWeightGrams', '默认单份重量', detail?.defaultSaleUnitWeightGrams ?? bean.defaultSaleUnitWeightGrams, ' g'),
      createCurrencyItem('defaultSaleUnitPrice', '默认单份售价', detail?.defaultSaleUnitPrice ?? bean.defaultSaleUnitPrice),
    ]),
    createSection('originQuality', '产地与品质', [
      createItem('originCountry', '产地国家', detail?.originCountry ?? bean.originCountry),
      createItem('originRegion', '产区', detail?.originRegion ?? bean.originRegion),
      createItem('originArea', '更细分产区', detail?.originArea ?? bean.originArea),
      createItem('supplierName', '生豆商', detail?.supplierName ?? bean.supplierName),
      flavorTags.length > 0
        ? { key: 'flavorTags', label: '风味', multiline: true, value: <FlavorTagChips tags={flavorTags} /> }
        : null,
      createItem('moisturePercent', '含水率', detail?.moisturePercent ?? bean.moisturePercent, '%'),
      createItem('altitudeMetersMin', '海拔下限', detail?.altitudeMetersMin ?? bean.altitudeMetersMin, ' m'),
      createItem('altitudeMetersMax', '海拔上限', detail?.altitudeMetersMax ?? bean.altitudeMetersMax, ' m'),
      createItem('densityGPerL', '密度', detail?.densityGPerL ?? bean.densityGPerL, ' g/L'),
    ]),
    createSection('postRoast', '烘焙后处理', [
      createItem('agingDays', '养豆时间', detail?.agingDays ?? bean.agingDays, ' 天'),
      createItem('tastingEndDays', '赏味结束期', detail?.tastingEndDays ?? bean.tastingEndDays, ' 天'),
    ]),
    createSection('notes', '补充说明', [
      detail?.notes ?? bean.notes
        ? { key: 'notes', label: '备注', multiline: true, value: detail?.notes ?? bean.notes ?? '' }
        : null,
      { key: 'updatedAt', label: '更新时间', value: formatShanghaiDateTime(bean.updatedAt) },
    ]),
  ];
};
