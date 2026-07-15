import { beforeEach, describe, expect, it } from 'vitest';

import { resetAppRuntimeState } from '@/app/services/appRuntimeStateReset.service';
import { beanCacheService } from '@/modules/bean/services';
import { localGreenBeanService } from '@/modules/bean/services/localGreenBean.service';
import { beanService } from '@/modules/bean/services/bean.service';
import { seedRoastPlans } from '@/modules/roast/constants/roastPlan.mock';
import { roastBatchService } from '@/modules/roast/services/roastBatch.service';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { useSettingsStore } from '@/modules/settings/store';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';

describe('appRuntimeStateReset.service', () => {
  beforeEach(() => {
    beanCacheService.clear();
    localGreenBeanService.clear();
    resetAppRuntimeState();
  });

  it('clears runtime data snapshots and settings store state', () => {
    beanCacheService.save([
      {
        code: 'GB-001',
        costPerKg: 100,
        createdAt: '2026-07-13T10:00:00.000Z',
        grade: 'G1',
        id: 'bean-1',
        name: '测试豆',
        origin: '埃塞俄比亚',
        process: '水洗',
        stockKg: 1,
        updatedAt: '2026-07-13T10:00:00.000Z',
      },
    ], 'remote');
    beanService.createOptimisticBean({
      agingDays: 14,
      altitudeMetersMax: null,
      altitudeMetersMin: null,
      code: 'GB-LOCAL-1',
      costTemplateId: null,
      defaultRoastInputGrams: 200,
      defaultSaleUnitPrice: 0,
      defaultSaleUnitWeightGrams: null,
      densityGPerL: null,
      displayName: '本地豆',
      flavorTags: [],
      grade: 'G1',
      harvestSeason: '',
      millName: '',
      moisturePercent: null,
      notes: '',
      originArea: '',
      originCountry: '埃塞俄比亚',
      originRegion: '',
      processMethod: '水洗',
      purchaseDate: '2026-07-13',
      purchasedTotalPrice: 0,
      purchasedWeightGrams: 1000,
      remainingWeightGrams: 1000,
      supplierName: '',
      tastingEndDays: 40,
      variety: '74110',
    });
    roastPlanService.createOptimisticPlan({
      batchWeightGrams: 200,
      beanId: 'bean-1',
      beanName: '测试豆',
      name: '测试计划',
      roasterModel: 'tank200d',
      purpose: '手冲',
      roastLevel: '浅烘',
      steps: [
        {
          event: '入豆',
          airTemperature: '180',
          drumSpeed: '45rpm',
          firePower: '80%',
          operation: '入豆',
          temperature: '200',
          time: '0:00',
        },
      ],
    });
    roastBatchService.createOptimisticBatch({
      evaluation: {
        allowTraining: false,
      },
      greenBeanId: 'bean-1',
      greenBeanName: '测试豆',
      inputWeightGrams: 200,
      outputWeightGrams: 170,
      roastDate: '2026-07-13T10:00:00.000Z',
      roastLevel: '浅烘',
      status: 'completed',
    });
    useSettingsStore.setState({
      appDisplaySettings: {
        ...useSettingsStore.getState().appDisplaySettings,
        scale: 1.1,
      },
      costTemplateSettings: {
        defaultTemplateId: 'template-1',
        templates: [
          {
            createdAt: '2026-07-13T10:00:00.000Z',
            dehydrationRate: 14,
            energyCost: 1,
            id: 'template-1',
            laborCost: 1,
            name: '模板',
            notes: '',
            otherCost: 0,
            packagingCost: 1,
            roastInputWeightGrams: 200,
            saleUnitWeightGrams: 20,
            targetProfitRate: 30,
            updatedAt: '2026-07-13T10:00:00.000Z',
          },
        ],
        updatedAt: '2026-07-13T10:00:00.000Z',
      },
      pocketBaseConnections: {
        ...useSettingsStore.getState().pocketBaseConnections,
        greenBean: {
          projectUrl: 'http://81.70.224.75',
          publishableKey: '',
        },
      },
    });

    resetAppRuntimeState();

    expect(beanCacheService.getBeans()).toBeNull();
    expect(localGreenBeanService.listRecords()).toEqual([]);
    expect(beanService.getBootstrappedBeans()).toEqual([]);
    expect(roastPlanService.getBootstrappedPlans()).toEqual(seedRoastPlans);
    expect(roastBatchService.getBootstrappedBatches()).toEqual([]);
    expect(useSettingsStore.getState().costTemplateSettings.templates).toEqual([]);
    expect(useSettingsStore.getState().pocketBaseConnections).toEqual(createDefaultPocketBaseConnectionSettings());
  });
});
