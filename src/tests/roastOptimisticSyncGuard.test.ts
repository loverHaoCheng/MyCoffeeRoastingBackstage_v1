import { beforeEach, describe, expect, it, vi } from 'vitest';

import { roastBatchService } from '@/modules/roast/services/roastBatch.service';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

const clearLocalRoastState = (): void => {
  roastBatchService.getBootstrappedBatches().forEach((batch) => {
    roastBatchService.removeOptimisticBatch(batch.id);
  });

  roastPlanService.getBootstrappedPlans().forEach((plan) => {
    roastPlanService.removeOptimisticPlan(plan.id);
  });
};

describe('roast optimistic sync guard', () => {
  beforeEach(() => {
    clearLocalRoastState();
    pocketBaseConnectionSettingsService.clear();
    pocketBaseConnectionSettingsService.save({
      ...createDefaultPocketBaseConnectionSettings(),
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      updatedAt: '2026-07-08T13:30:00.000Z',
    });
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    vi.restoreAllMocks();
  });

  it('does not upload optimistic local roast batches during background sync', async () => {
    const optimisticBatch = roastBatchService.createOptimisticBatch({
      greenBeanId: 'bean-1',
      greenBeanName: '测试生豆',
      inputWeightGrams: 200,
      outputWeightGrams: 180,
      roastDate: '2026-07-08T10:00:00.000Z',
      roastLevel: '中焙',
      status: 'completed',
    });

    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockResolvedValue([]);

    await expect(roastBatchService.syncLocalAndRemote()).resolves.toEqual({
      downloaded: 0,
      uploaded: 0,
    });

    expect(roastBatchService.hasPendingOptimisticCreations()).toBe(true);
    expect(listSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
    expect(roastBatchService.getBootstrappedBatches().some((batch) => batch.id === optimisticBatch.id)).toBe(true);
  });

  it('does not upload optimistic local roast plans during background sync', async () => {
    const optimisticPlan = roastPlanService.createOptimisticPlan({
      batchWeightGrams: 200,
      beanId: 'bean-1',
      beanName: '测试生豆',
      name: '测试计划',
      purpose: '手冲',
      roastLevel: '中焙',
      steps: [
        {
          event: '入豆',
          firePower: '80%',
          operation: '入豆',
          temperature: '200',
          time: '0:00',
        },
      ],
    });

    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockResolvedValue([]);

    await expect(roastPlanService.syncLocalAndRemote()).resolves.toEqual({
      downloaded: 0,
      uploaded: 0,
    });

    expect(roastPlanService.hasPendingOptimisticCreations()).toBe(true);
    expect(listSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
    expect(roastPlanService.getBootstrappedPlans().some((plan) => String(plan.id) === String(optimisticPlan.id))).toBe(true);
  });
});
