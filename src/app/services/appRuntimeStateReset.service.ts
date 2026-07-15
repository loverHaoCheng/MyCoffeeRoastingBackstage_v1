import { beanCacheService } from '@/modules/bean/services/beanCache.service';
import { beanSyncService } from '@/modules/bean/services/beanSync.service';
import {
  clearPendingOptimisticCreateBeanIds,
} from '@/modules/bean/services/bean.service.state';
import { localGreenBeanService } from '@/modules/bean/services/localGreenBean.service';
import { financeLedgerService, financeService } from '@/modules/finance/services';
import { clearRoastBatchState } from '@/modules/roast/services/roast-batch/roastBatch.service.state';
import { clearRoastCurveState } from '@/modules/roast/services/roast-curve/roastCurve.service.state';
import { clearRoastPlanState } from '@/modules/roast/services/roast-plan/roastPlan.service.state';
import { appDisplaySettingsService } from '@/modules/settings/services/appDisplaySettings.service';
import { costTemplateSettingsService } from '@/modules/settings/services/costTemplateSettings.service';
import { pocketBaseConnectionRuntimeService } from '@/modules/settings/services/pocketBaseConnectionRuntime.service';
import { useSettingsStore } from '@/modules/settings/store/useSettingsStore';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
} from '@/modules/settings/types';

export const resetAppRuntimeState = (): void => {
  beanCacheService.clear();
  beanSyncService.clearPendingOps();
  clearPendingOptimisticCreateBeanIds();
  localGreenBeanService.clear();
  clearRoastBatchState();
  clearRoastCurveState();
  clearRoastPlanState();
  financeService.clear();
  financeLedgerService.clear();
  appDisplaySettingsService.clear();
  costTemplateSettingsService.clear();
  pocketBaseConnectionRuntimeService.clear();

  useSettingsStore.setState({
    appDisplaySettings: createDefaultAppDisplaySettings(),
    costTemplateSettings: createDefaultCostTemplateSettings(),
    pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
  });
};
