import { describe, expect, it } from 'vitest';

import { buildMirrorData } from '@/modules/roast/services/roastedCoffeeBeanMirror.service';
import { pocketBaseSessionService } from '@/services/pocketBaseSession.service';
import type { Bean } from '@/types/domain';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';

describe('roastedCoffeeBeanMirrorService', () => {
  it('serializes mirror data as a JSON object instead of a quoted JSON string', () => {
    pocketBaseSessionService.save({
      user: {
        email: 'test@qq.com',
        id: 'user-1',
        name: '测试昵称',
      },
    });

    const batch: RoastBatchRecord = {
      id: 'batch-1',
      greenBeanId: 'bean-1',
      greenBeanName: '测试生豆',
      finalSaleUnitPrice: 12.5,
      roastDate: '2026-07-06T10:29:00+00:00',
      roastLevel: '中焙',
      inputWeightGrams: 200,
      outputWeightGrams: 170,
      salesMode: 'sale',
      status: 'completed',
      roastedBeanName: '测试熟豆',
      roastPlanName: '测试计划',
      imageUrls: ['https://example.com/front.jpg', 'https://example.com/back.jpg'],
      notes: '烘焙备注',
      createdAt: '2026-07-06T10:29:00+00:00',
      updatedAt: '2026-07-06T10:29:00+00:00',
    };

    const bean: Bean = {
      agingDays: 14,
      code: 'GB-001',
      id: 'bean-1',
      flavorTags: ['柑橘', '花香'],
      name: '测试生豆',
      origin: '埃塞俄比亚 · 古吉',
      process: '水洗',
      grade: 'G1',
      stockKg: 8,
      costPerKg: 120,
      tastingEndDays: 40,
      createdAt: '2026-07-06T00:00:00.000Z',
      updatedAt: '2026-07-06T00:00:00.000Z',
      defaultSaleUnitPrice: 10,
      defaultSaleUnitWeightGrams: 170,
      defaultRoastInputGrams: 200,
      notes: '生豆备注',
      supplierName: '耶加雪菲庄园',
      variety: '74158',
    };

    const mirrorData = buildMirrorData(batch, bean, {
      percentage: 100,
      estate: bean.name,
      origin: bean.origin,
      process: bean.process,
      variety: bean.variety ?? '',
    });

    const serialized = JSON.stringify({ data: mirrorData });

    expect(serialized.startsWith('{"data":{"id":"batch-1"')).toBe(true);
    expect(serialized).not.toContain('"data":"{');
    expect(mirrorData.name).toBe('测试熟豆 水洗');
    expect(mirrorData.sourceGreenBeanId).toBe('bean-1');
    expect(mirrorData.purchaseDate).toBe('2026-07-06T00:00:00.000Z');
    expect(mirrorData.price).toBe('12.5');
    expect(mirrorData.capacity).toBe('170');
    expect(mirrorData.remaining).toBe('170');
    expect(mirrorData.flavor).toEqual(['柑橘', '花香']);
    expect(mirrorData.startDay).toBe(14);
    expect(mirrorData.endDay).toBe(40);
    expect(mirrorData.roaster).toBe('测试昵称');
    expect(mirrorData.brand).toBe('耶加雪菲庄园');
    expect(mirrorData.image).toBe('https://example.com/front.jpg');
    expect(mirrorData.backImage).toBe('https://example.com/back.jpg');
    expect(mirrorData.roastDate).toBe('2026-07-06');
    expect(mirrorData.roastBatchId).toBe('batch-1');
    expect(mirrorData.inputWeightGrams).toBe(200);
    expect(mirrorData.outputWeightGrams).toBe(170);
    expect(mirrorData.roastLevel).toBe('中度烘焙');
    expect(mirrorData.greenBeanCode).toBe('GB-001');
    expect(mirrorData.greenBeanSupplierName).toBe('耶加雪菲庄园');
    expect(mirrorData.beanState).toBe('roasted');
    expect(mirrorData.beanType).toBe('filter');
    expect(mirrorData.blendComponents[0]?.percentage).toBe(100);
  });

  it('falls back to green bean name plus process when roasted bean name is empty', () => {
    pocketBaseSessionService.clear();

    const batch: RoastBatchRecord = {
      id: 'batch-2',
      greenBeanId: 'bean-2',
      greenBeanName: '耶加雪菲 G1',
      roastDate: '2026-07-06T10:29:00+00:00',
      roastLevel: '浅焙',
      inputWeightGrams: 200,
      outputWeightGrams: 170,
      salesMode: 'sale',
      status: 'completed',
      roastedBeanName: '',
      roastPlanName: '测试计划',
      imageUrls: [],
      notes: '',
      createdAt: '2026-07-06T10:29:00+00:00',
      updatedAt: '2026-07-06T10:29:00+00:00',
    };

    const bean: Bean = {
      agingDays: 14,
      id: 'bean-2',
      flavorTags: [],
      name: '耶加雪菲 G1',
      origin: '埃塞俄比亚',
      process: '日晒',
      grade: 'G1',
      stockKg: 8,
      costPerKg: 120,
      tastingEndDays: 40,
      createdAt: '2026-07-06T00:00:00.000Z',
      updatedAt: '2026-07-06T00:00:00.000Z',
    };

    const mirrorData = buildMirrorData(batch, bean, {
      percentage: 100,
      estate: bean.name,
      origin: bean.origin,
      process: bean.process,
      variety: '',
    });

    expect(mirrorData.name).toBe('耶加雪菲 G1 日晒');
    expect(mirrorData.roaster).toBe('');
  });
});
