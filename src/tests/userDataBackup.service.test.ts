import { afterEach, describe, expect, it, vi } from 'vitest';

import { userDataBackupService, type UserDataBackupFile } from '@/modules/settings/services/userDataBackup.service';
import { AppError } from '@/shared/errors/AppError';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';
import { pocketBaseSessionService } from '@/services/pocketBaseSession.service';

const backupCollectionNames = [
  'green_beans',
  'green_bean_purchase_batches',
  'bean_sale_specs',
  'roast_profiles',
  'roast_batches',
  'roast_curve_records',
  'roast_records',
  'finance_expense_records',
  'cost_calculations',
  'app_settings',
] as const;

describe('userDataBackupService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pocketBaseSessionService.clear();
  });

  it('keeps exporting when an optional backup collection is not initialized', async () => {
    const missingCollectionError = new AppError('PocketBase 记录或集合不存在，请先执行初始化。', {
      code: 'HTTP',
      status: 404,
    });

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation(
      <TOutput,>(collectionName: string): Promise<TOutput[]> => {
        if (collectionName === 'roast_records') {
          throw missingCollectionError;
        }

        return Promise.resolve([{ id: `${collectionName}-1` }] as TOutput[]);
      },
    );

    await expect(userDataBackupService.createBackup()).resolves.toMatchObject({
      collections: {
        roast_records: [],
      },
      summary: {
        roast_records: 0,
      },
    });
  });

  it('retries backup export without sorting when PocketBase rejects a collection sort', async () => {
    const sortError = new AppError('PocketBase 请求失败，请稍后重试或联系管理员检查服务日志。（HTTP 400）', {
      code: 'HTTP',
      status: 400,
    });
    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation(
      <TOutput,>(collectionName: string, options?: { orderBy?: unknown }): Promise<TOutput[]> => {
        if (collectionName === 'green_beans' && options?.orderBy) {
          throw sortError;
        }

        return Promise.resolve([{ id: `${collectionName}-1` }] as TOutput[]);
      },
    );

    await expect(userDataBackupService.createBackup()).resolves.toMatchObject({
      collections: {
        green_beans: [{ id: 'green_beans-1' }],
      },
      summary: {
        green_beans: 1,
      },
    });
    expect(listSpy).toHaveBeenCalledWith('green_beans', expect.objectContaining({
      orderBy: {
        ascending: true,
        column: 'created',
      },
    }));
    expect(listSpy).toHaveBeenCalledWith('green_beans', {
      limit: 10_000,
    });
  });

  it('regenerates ids and rewrites relations when importing an old account backup into a new account', async () => {
    const generatedIds: Record<string, string> = {
      app_settings: 'setting-new',
      green_beans: 'bean-new',
      roast_batches: 'batch-new',
      roast_curve_records: 'curve-new',
      roast_profiles: 'plan-new',
    };
    const backup: UserDataBackupFile = {
      collections: {
        app_settings: [
          {
            id: 'setting-old',
            key: 'green_bean_sale_defaults:bean-old',
            owner: 'old-user',
            value: { defaultSaleUnitPrice: 88 },
          },
        ],
        green_beans: [
          {
            id: 'bean-old',
            display_name: 'Guji',
            owner: 'old-user',
          },
        ],
        roast_batches: [
          {
            id: 'batch-old',
            green_bean_id: 'bean-old',
            roast_plan_id: 'plan-old',
          },
        ],
        roast_curve_records: [
          {
            id: 'curve-old',
            roast_batch_id: 'batch-old',
          },
        ],
        roast_profiles: [
          {
            id: 'plan-old',
            green_bean_id: 'bean-old',
            name: 'Plan',
          },
        ],
      },
      exportedAt: '2026-07-15T08:00:00.000Z',
      schema: 'easybake.user-data-backup',
      summary: {},
      version: 1,
    };

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockImplementation(
      <TOutput,>(collectionName: string): Promise<TOutput[]> => {
        return Promise.resolve([{ id: generatedIds[collectionName] ?? `${collectionName}-new` }] as TOutput[]);
      },
    );

    await expect(userDataBackupService.importBackup(backup)).resolves.toEqual({
      deleted: 0,
      imported: 5,
      skipped: 0,
      updated: 0,
    });

    expect(insertSpy).toHaveBeenCalledWith('green_beans', expect.not.objectContaining({
      id: 'bean-old',
      owner: 'old-user',
    }));
    expect(insertSpy).toHaveBeenCalledWith('roast_profiles', expect.objectContaining({
      green_bean_id: 'bean-new',
    }));
    expect(insertSpy).toHaveBeenCalledWith('roast_batches', expect.objectContaining({
      green_bean_id: 'bean-new',
      roast_plan_id: 'plan-new',
    }));
    expect(insertSpy).toHaveBeenCalledWith('roast_curve_records', expect.objectContaining({
      roast_batch_id: 'batch-new',
    }));
    expect(insertSpy).toHaveBeenCalledWith('app_settings', expect.objectContaining({
      key: 'green_bean_sale_defaults:bean-new',
      value: { defaultSaleUnitPrice: 88 },
    }));
  });

  it('keeps same-code beans separate across accounts and links purchase batches to the imported bean id', async () => {
    pocketBaseSessionService.save({
      user: {
        email: 'current@example.com',
        id: 'current-user',
      },
    });
    const backup: UserDataBackupFile = {
      collections: {
        green_bean_purchase_batches: [
          {
            id: 'purchase-old',
            green_bean_id: 'bean-old',
            purchased_weight_grams: 1000,
            remaining_weight_grams: 1000,
          },
        ],
        green_beans: [
          {
            id: 'bean-old',
            code: 'GB-001',
            display_name: '重复生豆',
            owner: 'old-user',
          },
        ],
      },
      exportedBy: {
        email: 'old@example.com',
        id: 'old-user',
      },
      exportedAt: '2026-07-15T08:00:00.000Z',
      schema: 'easybake.user-data-backup',
      summary: {},
      version: 1,
    };

    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockImplementation(
      <TOutput,>(collectionName: string, payload: Record<string, unknown>): Promise<TOutput[]> => {
        if (collectionName === 'green_beans') {
          return Promise.resolve([{ id: 'bean-imported' }] as TOutput[]);
        }

        return Promise.resolve([{ id: `${collectionName}-new`, ...payload }] as TOutput[]);
      },
    );

    await expect(userDataBackupService.importBackup(backup)).resolves.toEqual({
      deleted: 0,
      imported: 2,
      skipped: 0,
      updated: 0,
    });

    expect(listSpy).not.toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalledWith('green_beans', expect.not.objectContaining({
      id: 'bean-old',
      owner: 'old-user',
    }));
    expect(listSpy).not.toHaveBeenCalledWith('green_beans', expect.objectContaining({
      match: {
        code: 'GB-001',
      },
    }));
    expect(insertSpy).toHaveBeenCalledWith('green_bean_purchase_batches', expect.objectContaining({
      green_bean_id: 'bean-imported',
      purchased_weight_grams: 1000,
      remaining_weight_grams: 1000,
    }));
  });

  it('supplements same-account backups by id instead of merging beans with the same code', async () => {
    pocketBaseSessionService.save({
      user: {
        email: 'current@example.com',
        id: 'current-user',
      },
    });
    const backup: UserDataBackupFile = {
      collections: {
        green_beans: [
          {
            id: 'bean-from-backup',
            code: 'GB-001',
            display_name: '同号补缺生豆',
            owner: 'current-user',
          },
        ],
      },
      exportedBy: {
        email: 'current@example.com',
        id: 'current-user',
      },
      exportedAt: '2026-07-15T08:00:00.000Z',
      schema: 'easybake.user-data-backup',
      summary: {},
      version: 1,
    };

    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation(
      <TOutput,>(collectionName: string, options?: { match?: Record<string, unknown> }): Promise<TOutput[]> => {
        if (collectionName === 'green_beans' && options?.match?.id === 'bean-from-backup') {
          return Promise.resolve([]);
        }

        if (collectionName === 'green_beans' && options?.match?.code === 'GB-001') {
          return Promise.resolve([{ id: 'bean-current', code: 'GB-001' }] as TOutput[]);
        }

        return Promise.resolve([]);
      },
    );
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockImplementation(
      <TOutput,>(_collectionName: string, payload: Record<string, unknown>): Promise<TOutput[]> => {
        return Promise.resolve([{ id: payload.id }] as TOutput[]);
      },
    );

    await expect(userDataBackupService.importBackup(backup)).resolves.toEqual({
      deleted: 0,
      imported: 1,
      skipped: 0,
      updated: 0,
    });

    expect(insertSpy).toHaveBeenCalledWith('green_beans', expect.objectContaining({
      code: 'GB-001',
      display_name: '同号补缺生豆',
      id: 'bean-from-backup',
    }));
    expect(listSpy).not.toHaveBeenCalledWith('green_beans', expect.objectContaining({
      match: {
        code: 'GB-001',
      },
    }));
  });

  it('skips existing same-account records by PocketBase id and keeps their relation mapping', async () => {
    pocketBaseSessionService.save({
      user: {
        email: 'current@example.com',
        id: 'current-user',
      },
    });
    const backup: UserDataBackupFile = {
      collections: {
        green_bean_purchase_batches: [
          {
            id: 'purchase-from-backup',
            green_bean_id: 'bean-existing',
            owner: 'current-user',
            purchased_weight_grams: 1000,
          },
        ],
        green_beans: [
          {
            id: 'bean-existing',
            code: 'GB-001',
            owner: 'current-user',
          },
        ],
      },
      exportedBy: {
        email: 'current@example.com',
        id: 'current-user',
      },
      exportedAt: '2026-07-15T08:00:00.000Z',
      schema: 'easybake.user-data-backup',
      summary: {},
      version: 1,
    };

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation(
      <TOutput,>(collectionName: string, options?: { match?: Record<string, unknown> }): Promise<TOutput[]> => {
        if (collectionName === 'green_beans' && options?.match?.id === 'bean-existing') {
          return Promise.resolve([{ id: 'bean-existing' }] as TOutput[]);
        }

        return Promise.resolve([]);
      },
    );
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockImplementation(
      <TOutput,>(_collectionName: string, payload: Record<string, unknown>): Promise<TOutput[]> => {
        return Promise.resolve([{ id: payload.id }] as TOutput[]);
      },
    );

    await expect(userDataBackupService.importBackup(backup)).resolves.toEqual({
      deleted: 0,
      imported: 1,
      skipped: 1,
      updated: 0,
    });

    expect(insertSpy).not.toHaveBeenCalledWith('green_beans', expect.anything());
    expect(insertSpy).toHaveBeenCalledWith('green_bean_purchase_batches', expect.objectContaining({
      green_bean_id: 'bean-existing',
      id: 'purchase-from-backup',
      purchased_weight_grams: 1000,
    }));
  });

  it('continues importing app settings with a regenerated id after a same-account duplicate id conflict', async () => {
    pocketBaseSessionService.save({
      user: {
        email: 'current@example.com',
        id: 'current-user',
      },
    });
    const duplicateIdError = new AppError('提交失败：id已存在，请更换后重试', {
      code: 'HTTP',
      status: 400,
    });
    const backup: UserDataBackupFile = {
      collections: {
        app_settings: [
          {
            id: 'setting-existing',
            key: 'green_bean_grade:bean-existing',
            owner: 'current-user',
            value: { grade: 'G1' },
          },
          {
            id: 'setting-cost-template',
            key: 'cost_template_settings',
            owner: 'current-user',
            value: {
              defaultTemplateId: 'template-1',
              templates: [
                {
                  createdAt: '2026-07-15T08:00:00.000Z',
                  defaultBakeWeight: 1000,
                  dehydrationRate: 15,
                  energyCost: 2,
                  id: 'template-1',
                  laborCost: 5,
                  name: '默认成本模板',
                  otherCost: 0,
                  packagingCost: 1,
                  targetProfitRate: 30,
                  unitWeightGrams: 100,
                },
              ],
              updatedAt: '2026-07-15T08:00:00.000Z',
            },
          },
        ],
      },
      exportedBy: {
        email: 'current@example.com',
        id: 'current-user',
      },
      exportedAt: '2026-07-15T08:00:00.000Z',
      schema: 'easybake.user-data-backup',
      summary: {},
      version: 1,
    };

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockImplementation(
      <TOutput,>(_collectionName: string, payload: Record<string, unknown>): Promise<TOutput[]> => {
        if (payload.id === 'setting-existing') {
          throw duplicateIdError;
        }

        return Promise.resolve([{ id: typeof payload.id === 'string' ? payload.id : 'setting-regenerated' }] as TOutput[]);
      },
    );

    await expect(userDataBackupService.importBackup(backup)).resolves.toEqual({
      deleted: 0,
      imported: 2,
      skipped: 0,
      updated: 0,
    });

    expect(insertSpy).toHaveBeenCalledWith('app_settings', expect.not.objectContaining({
      id: 'setting-existing',
      owner: 'current-user',
    }));
    expect(insertSpy).toHaveBeenCalledWith('app_settings', expect.objectContaining({
      id: 'setting-cost-template',
      key: 'cost_template_settings',
    }));
  });

  it('supplements missing same-account app settings instead of treating write validation errors as optional collection gaps', async () => {
    pocketBaseSessionService.save({
      user: {
        email: 'current@example.com',
        id: 'current-user',
      },
    });
    const backup: UserDataBackupFile = {
      collections: {
        app_settings: [
          {
            created_at: '2026-07-15T08:00:00.000Z',
            id: 'setting-cost-template',
            key: 'cost_template_settings',
            owner: 'current-user',
            updated_at: '2026-07-15T08:10:00.000Z',
            value: {
              defaultTemplateId: 'template-1',
              templates: [
                {
                  createdAt: '2026-07-15T08:00:00.000Z',
                  defaultBakeWeight: 1000,
                  dehydrationRate: 15,
                  energyCost: 2,
                  id: 'template-1',
                  laborCost: 5,
                  name: '默认成本模板',
                  otherCost: 0,
                  packagingCost: 1,
                  targetProfitRate: 30,
                  unitWeightGrams: 100,
                },
              ],
              updatedAt: '2026-07-15T08:10:00.000Z',
            },
          },
        ],
      },
      exportedBy: {
        email: 'current@example.com',
        id: 'current-user',
      },
      exportedAt: '2026-07-15T08:00:00.000Z',
      schema: 'easybake.user-data-backup',
      summary: {},
      version: 1,
    };

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockImplementation(
      <TOutput,>(_collectionName: string, payload: Record<string, unknown>): Promise<TOutput[]> => {
        return Promise.resolve([{ id: payload.id }] as TOutput[]);
      },
    );

    await expect(userDataBackupService.importBackup(backup)).resolves.toEqual({
      deleted: 0,
      imported: 1,
      skipped: 0,
      updated: 0,
    });

    expect(insertSpy).toHaveBeenCalledWith('app_settings', expect.objectContaining({
      id: 'setting-cost-template',
      key: 'cost_template_settings',
    }));
    expect(insertSpy).toHaveBeenCalledWith('app_settings', expect.not.objectContaining({
      created_at: '2026-07-15T08:00:00.000Z',
      owner: 'current-user',
      updated_at: '2026-07-15T08:10:00.000Z',
    }));
  });

  it('surfaces non-collection app settings write errors during import', async () => {
    pocketBaseSessionService.save({
      user: {
        email: 'current@example.com',
        id: 'current-user',
      },
    });
    const validationError = new AppError('提交失败：value不能为空', {
      code: 'HTTP',
      status: 400,
    });
    const backup: UserDataBackupFile = {
      collections: {
        app_settings: [
          {
            id: 'setting-invalid',
            key: 'cost_template_settings',
            owner: 'current-user',
            value: null,
          },
        ],
      },
      exportedBy: {
        email: 'current@example.com',
        id: 'current-user',
      },
      exportedAt: '2026-07-15T08:00:00.000Z',
      schema: 'easybake.user-data-backup',
      summary: {},
      version: 1,
    };

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);
    vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockRejectedValue(validationError);

    await expect(userDataBackupService.importBackup(backup)).rejects.toThrow('value不能为空');
  });

  it('fully syncs same-account backups by deleting extras, updating matches, and inserting missing records', async () => {
    pocketBaseSessionService.save({
      user: {
        email: 'current@example.com',
        id: 'current-user',
      },
    });
    const backup: UserDataBackupFile = {
      collections: {
        green_beans: [
          {
            id: 'bean-a',
            display_name: '正式端生豆 A',
            owner: 'current-user',
          },
          {
            id: 'bean-c',
            display_name: '正式端新增生豆 C',
            owner: 'current-user',
          },
        ],
      },
      exportedBy: {
        email: 'current@example.com',
        id: 'current-user',
      },
      exportedAt: '2026-07-15T08:00:00.000Z',
      schema: 'easybake.user-data-backup',
      summary: {},
      version: 1,
    };

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation(
      <TOutput,>(collectionName: string, options?: { match?: Record<string, unknown> }): Promise<TOutput[]> => {
        if (collectionName === 'green_beans' && !options?.match) {
          return Promise.resolve([{ id: 'bean-a' }, { id: 'bean-b' }] as TOutput[]);
        }

        if (collectionName === 'green_beans' && options?.match?.id === 'bean-a') {
          return Promise.resolve([{ id: 'bean-a' }] as TOutput[]);
        }

        return Promise.resolve([]);
      },
    );
    const deleteSpy = vi.spyOn(PocketBaseRestClient.prototype, 'delete').mockResolvedValue(undefined);
    const updateSpy = vi.spyOn(PocketBaseRestClient.prototype, 'update').mockImplementation(
      <TOutput,>(_collectionName: string, payload: Record<string, unknown>): Promise<TOutput[]> => {
        return Promise.resolve([{ id: 'bean-a', ...payload }] as TOutput[]);
      },
    );
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockImplementation(
      <TOutput,>(_collectionName: string, payload: Record<string, unknown>): Promise<TOutput[]> => {
        return Promise.resolve([{ id: payload.id }] as TOutput[]);
      },
    );

    await expect(userDataBackupService.importBackup(backup, { strategy: 'sync' })).resolves.toEqual({
      deleted: 1,
      imported: 1,
      skipped: 0,
      updated: 1,
    });

    expect(deleteSpy).toHaveBeenCalledWith('green_beans', {
      match: {
        id: 'bean-b',
      },
    });
    expect(updateSpy).toHaveBeenCalledWith('green_beans', expect.objectContaining({
      display_name: '正式端生豆 A',
    }), expect.objectContaining({
      match: {
        id: 'bean-a',
      },
    }));
    expect(updateSpy).toHaveBeenCalledWith('green_beans', expect.not.objectContaining({
      id: 'bean-a',
      owner: 'current-user',
    }), expect.anything());
    expect(insertSpy).toHaveBeenCalledWith('green_beans', expect.objectContaining({
      display_name: '正式端新增生豆 C',
      id: 'bean-c',
    }));
  });

  it('applies the cross-account id regeneration strategy to every backup collection', async () => {
    pocketBaseSessionService.save({
      user: {
        email: 'current@example.com',
        id: 'current-user',
      },
    });
    const collections: UserDataBackupFile['collections'] = {
      app_settings: [{ id: 'app_settings-old', key: 'cost_template_settings', owner: 'old-user', value: {} }],
      bean_sale_specs: [{ id: 'bean_sale_specs-old', owner: 'old-user' }],
      cost_calculations: [{ id: 'cost_calculations-old', owner: 'old-user' }],
      finance_expense_records: [{ id: 'finance_expense_records-old', owner: 'old-user' }],
      green_bean_purchase_batches: [{ id: 'green_bean_purchase_batches-old', owner: 'old-user' }],
      green_beans: [{ id: 'green_beans-old', owner: 'old-user' }],
      roast_batches: [{ id: 'roast_batches-old', owner: 'old-user' }],
      roast_curve_records: [{ id: 'roast_curve_records-old', owner: 'old-user' }],
      roast_profiles: [{ id: 'roast_profiles-old', owner: 'old-user' }],
      roast_records: [{ id: 'roast_records-old', owner: 'old-user' }],
    };
    const backup: UserDataBackupFile = {
      collections,
      exportedBy: {
        email: 'old@example.com',
        id: 'old-user',
      },
      exportedAt: '2026-07-15T08:00:00.000Z',
      schema: 'easybake.user-data-backup',
      summary: {},
      version: 1,
    };

    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);
    const insertSpy = vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockImplementation(
      <TOutput,>(collectionName: string): Promise<TOutput[]> => {
        return Promise.resolve([{ id: `${collectionName}-new` }] as TOutput[]);
      },
    );

    await expect(userDataBackupService.importBackup(backup)).resolves.toEqual({
      deleted: 0,
      imported: backupCollectionNames.length,
      skipped: 0,
      updated: 0,
    });

    expect(listSpy).not.toHaveBeenCalled();
    backupCollectionNames.forEach((collectionName) => {
      expect(insertSpy).toHaveBeenCalledWith(collectionName, expect.not.objectContaining({
        id: `${collectionName}-old`,
        owner: 'old-user',
      }));
    });
  });
});
