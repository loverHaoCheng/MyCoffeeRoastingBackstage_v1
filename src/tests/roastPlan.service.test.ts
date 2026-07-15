import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

describe('roastPlanService', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'development');
    pocketBaseConnectionSettingsService.clear();
    pocketBaseConnectionSettingsService.save({
      ...createDefaultPocketBaseConnectionSettings(),
      greenBean: {
        projectUrl: 'https://green-demo.pocketbase.local',
        publishableKey: '',
      },
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('detaches historical batches before deleting a referenced roast plan', async () => {
    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([
      { id: 'batch-1' },
      { id: 'batch-2' },
    ]);
    const updateSpy = vi.spyOn(PocketBaseRestClient.prototype, 'update').mockResolvedValue([]);
    const deleteSpy = vi.spyOn(PocketBaseRestClient.prototype, 'delete').mockResolvedValue();

    await expect(roastPlanService.deletePlan('plan-1')).resolves.toMatchObject({ data: null });

    expect(listSpy).toHaveBeenCalledWith('roast_batches', {
      match: { roast_plan_id: 'plan-1' },
      select: 'id',
    });
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenCalledWith(
      'roast_batches',
      {
        roast_plan_id: null,
        roast_plan_name: null,
      },
      { match: { id: 'batch-1' }, select: 'id' },
    );
    expect(deleteSpy).toHaveBeenCalledWith('roast_profiles', {
      match: { id: 'plan-1' },
    });
    expect(updateSpy.mock.invocationCallOrder.at(-1)).toBeLessThan(deleteSpy.mock.invocationCallOrder[0] ?? 0);
  });

  it('deletes an unused roast plan without attempting batch updates', async () => {
    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);
    const updateSpy = vi.spyOn(PocketBaseRestClient.prototype, 'update').mockResolvedValue([]);
    const deleteSpy = vi.spyOn(PocketBaseRestClient.prototype, 'delete').mockResolvedValue();

    await roastPlanService.deletePlan('plan-2');

    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledWith('roast_profiles', {
      match: { id: 'plan-2' },
    });
  });
});
