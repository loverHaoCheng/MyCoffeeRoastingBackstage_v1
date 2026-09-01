import { describe, expect, it } from 'vitest';

import { buildBeanDetailSections } from '@/modules/bean/components/bean-detail/beanDetailView.utils';
import type { GreenBeanEditableDetail } from '@/modules/bean/types';
import type { Bean } from '@/types/domain';

const bean: Bean = {
  code: 'GB-001',
  costPerKg: 120,
  createdAt: '2026-08-17T00:00:00.000Z',
  id: 'bean-1',
  grade: 'G1',
  name: '测试生豆',
  origin: '埃塞俄比亚',
  process: '水洗',
  stockKg: 1,
  updatedAt: '2026-08-17T00:00:00.000Z',
};

const detail: GreenBeanEditableDetail = {
  agingDays: 14,
  altitudeMetersMax: 2100,
  altitudeMetersMin: 1900,
  beanId: 'bean-1',
  code: 'GB-001',
  costTemplateId: 'template-1',
  defaultRoastInputGrams: 500,
  defaultSaleUnitPrice: 60,
  defaultSaleUnitWeightGrams: 200,
  densityGPerL: 720,
  displayName: '测试生豆',
  flavorTags: ['柑橘'],
  grade: 'G1',
  harvestSeason: '2025/26',
  millName: '海神处理厂',
  moisturePercent: 10.5,
  notes: '杯测备注',
  originArea: '沃卡',
  originCountry: '埃塞俄比亚',
  originRegion: '耶加雪菲',
  processMethod: '水洗',
  purchaseDate: '2026-08-17',
  purchasedTotalPrice: 120,
  purchasedWeightGrams: 1000,
  remainingWeightGrams: 800,
  supplierName: '供应商',
  tastingEndDays: 40,
  variety: 'Heirloom',
};

describe('buildBeanDetailSections', () => {
  it('includes every populated editable field in the detail view', () => {
    const labels = buildBeanDetailSections({ bean, costTemplateLabel: '默认模板', detail })
      .flatMap((section) => section.items)
      .map((item) => item.label);

    expect(labels).toEqual(expect.arrayContaining([
      '名称', '编号', '等级', '处理法', '豆种', '产季', '处理厂', '采购日期', '购买重量', '剩余重量',
      '购买总价', '成本', '成本模板', '默认烘焙量', '默认单份重量', '默认单份售价', '产地国家', '产区',
      '更细分产区', '生豆商', '风味', '含水率', '海拔下限', '海拔上限', '密度', '养豆时间', '赏味结束期', '备注',
    ]));
  });
});
