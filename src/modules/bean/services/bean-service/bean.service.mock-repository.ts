import { beanCacheService } from '@/modules/bean/services/beanCache.service';
import { AppError } from '@/shared/errors/AppError';
import type { Bean } from '@/types/domain';

import type { GreenBeanCreateInput } from '../../types';
import { createMockBean, ok } from './bean.service.shared';
import type { BeanRepository } from './bean.service.types';

export class MockBeanRepository implements BeanRepository {
  private readonly beans: Bean[];

  constructor(beans: Bean[] = beanCacheService.getBeans() ?? []) {
    this.beans = [...beans];
  }

  getBeanById(beanId: string | number) {
    return Promise.resolve(ok(this.beans.find((bean) => String(bean.id) === String(beanId)) ?? null));
  }

  adjustRemainingWeight(beanId: string | number, deltaGrams: number) {
    const bean = this.beans.find((item) => String(item.id) === String(beanId));

    if (!bean) {
      throw new AppError('未找到生豆记录。', { code: 'DATA' });
    }

    const nextStockKg = bean.stockKg - deltaGrams / 1000;

    if (nextStockKg < 0) {
      throw new AppError('剩余库存不足，无法记录本次烘焙。', { code: 'DATA' });
    }

    bean.stockKg = Number(nextStockKg.toFixed(1));
    bean.updatedAt = new Date().toISOString();

    return Promise.resolve(ok(bean));
  }

  getEditableBean(beanId: string | number) {
    const bean = this.beans.find((item) => String(item.id) === String(beanId));

    if (!bean) {
      return Promise.reject(new AppError('未找到生豆记录。', { code: 'DATA' }));
    }

    return Promise.resolve(
      ok({
        beanId: String(bean.id),
        agingDays: bean.agingDays ?? 14,
        code: bean.code ?? '',
        costTemplateId: bean.costTemplateId ?? null,
        defaultRoastInputGrams: bean.defaultRoastInputGrams ?? 200,
        defaultSaleUnitPrice: bean.defaultSaleUnitPrice ?? 0,
        defaultSaleUnitWeightGrams: bean.defaultSaleUnitWeightGrams ?? 100,
        displayName: bean.name,
        flavorTags: bean.flavorTags ?? [],
        grade: bean.grade,
        harvestSeason: bean.harvestSeason ?? '',
        millName: null,
        notes: null,
        originArea: null,
        originCountry: bean.origin.split(' · ')[0] ?? '',
        originRegion: bean.origin.split(' · ')[1] ?? '',
        processMethod: bean.process,
        purchaseDate: bean.purchaseDate ?? bean.createdAt.slice(0, 10),
        purchasedTotalPrice: Math.round(bean.costPerKg * bean.stockKg),
        purchasedWeightGrams: Math.round(bean.stockKg * 1000),
        remainingWeightGrams: Math.round(bean.stockKg * 1000),
        supplierName: bean.supplierName ?? null,
        tastingEndDays: bean.tastingEndDays ?? 40,
        variety: bean.variety ?? bean.grade,
        altitudeMetersMax: null,
        altitudeMetersMin: null,
        densityGPerL: null,
        moisturePercent: null,
      }),
    );
  }

  listBeans() {
    beanCacheService.save(this.beans, 'mock');

    return Promise.resolve(ok(this.beans));
  }

  syncBeans() {
    return this.listBeans();
  }

  updateBean(beanId: string | number) {
    const bean = this.beans.find((b) => String(b.id) === String(beanId));

    if (!bean) {
      throw new AppError('未找到生豆记录。', { code: 'DATA' });
    }

    return Promise.resolve(ok(bean));
  }

  deleteBean() {
    return Promise.resolve();
  }

  createBean(input: GreenBeanCreateInput) {
    const bean = createMockBean(input);

    this.beans.unshift(bean);
    beanCacheService.save(this.beans, 'mock');

    return Promise.resolve(ok(bean));
  }
}
