import { beforeEach, describe, expect, it, vi } from 'vitest';

import { financeLedgerService } from '@/modules/finance/services';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';
import { AppError } from '@/shared/errors/AppError';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

describe('financeLedgerService', () => {
  beforeEach(() => {
    financeLedgerService.clear();
    pocketBaseConnectionSettingsService.clear();
    pocketBaseConnectionSettingsService.save(createDefaultPocketBaseConnectionSettings());
    vi.restoreAllMocks();
  });

  it('reads expense records from PocketBase collections', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation((collectionName) => {
      if (collectionName === 'finance_expense_records') {
        return Promise.resolve([{
          amount: 18.5,
          category: 'packaging',
          created_at: '2026-07-09T10:00:00.000Z',
          custom_category_label: null,
          expense_date: '2026-07-09',
          id: 'expense-1',
          notes: 'test',
          source: 'manual',
          source_entity_id: null,
          status: 'paid',
          title: '包装袋',
          updated_at: '2026-07-09T10:00:00.000Z',
        }]);
      }

      return Promise.resolve([]);
    });

    await expect(financeLedgerService.listExpenseRecords()).resolves.toMatchObject({
      code: 0,
      data: [{
        amount: 18.5,
        category: 'packaging',
        expenseDate: '2026-07-09',
        id: 'expense-1',
        notes: 'test',
        source: 'manual',
        sourceEntityId: null,
        status: 'paid',
        title: '包装袋',
      }],
      message: 'ok',
    });

    expect(listSpy).toHaveBeenCalledWith('finance_expense_records', {
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });
  });

  it('uses the same-origin business data service even when stored green bean settings are empty', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: '',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockResolvedValue([]);

    await expect(financeLedgerService.listExpenseRecords()).resolves.toMatchObject({
      code: 0,
      data: [],
      message: 'ok',
    });

    expect(listSpy).toHaveBeenCalledWith('finance_expense_records', {
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });
  });

  it('reads income records from PocketBase collections', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    const listSpy = vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation((collectionName) => {
      if (collectionName === 'finance_income_records') {
        return Promise.resolve([{
          amount: 128,
          channel: 'retail',
          created_at: '2026-07-09T10:00:00.000Z',
          id: 'income-1',
          income_date: '2026-07-09',
          notes: 'manual income',
          status: 'received',
          title: '零售收入',
          updated_at: '2026-07-09T10:00:00.000Z',
        }]);
      }

      return Promise.resolve([]);
    });

    await expect(financeLedgerService.listIncomeRecords()).resolves.toMatchObject({
      code: 0,
      data: [{
        amount: 128,
        channel: 'retail',
        id: 'income-1',
        incomeDate: '2026-07-09',
        notes: 'manual income',
        source: 'manual',
        sourceEntityId: null,
        status: 'received',
        title: '零售收入',
      }],
      message: 'ok',
    });

    expect(listSpy).toHaveBeenCalledWith('finance_income_records', {
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });
  });

  it('does not fail income reads when the optional income collection is not ready yet', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockRejectedValue(
      new AppError('集合不存在', {
        code: 'DATA',
        status: 404,
      }),
    );

    await expect(financeLedgerService.listIncomeRecords()).resolves.toMatchObject({
      code: 0,
      data: [],
      message: 'ok',
    });
    expect(financeLedgerService.getBootstrappedIncomeRecords()).toEqual([]);
  });

  it('does not fail income reads when the existing income collection has incomplete rules or fields', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockRejectedValue(
      new AppError('Only superusers can perform this action.', {
        code: 'AUTH',
        status: 403,
      }),
    );

    await expect(financeLedgerService.listIncomeRecords()).resolves.toMatchObject({
      code: 0,
      data: [],
      message: 'ok',
    });
  });

  it('does not fail income reads when the optional income endpoint returns a server error', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockRejectedValue(
      new AppError('PocketBase 服务暂时不可用，请稍后重试。', {
        code: 'HTTP',
        status: 500,
      }),
    );

    await expect(financeLedgerService.listIncomeRecords()).resolves.toMatchObject({
      code: 0,
      data: [],
      message: 'ok',
    });
  });

  it('keeps ledger sync successful when only the optional income collection is missing', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation((collectionName) => {
      if (collectionName === 'finance_expense_records') {
        return Promise.resolve([{
          amount: 18.5,
          category: 'packaging',
          created_at: '2026-07-09T10:00:00.000Z',
          custom_category_label: null,
          expense_date: '2026-07-09',
          id: 'expense-1',
          notes: 'test',
          source: 'manual',
          source_entity_id: null,
          status: 'paid',
          title: '包装袋',
          updated_at: '2026-07-09T10:00:00.000Z',
        }]);
      }

      if (collectionName === 'finance_income_records') {
        return Promise.reject(new AppError('Only superusers can perform this action.', {
          code: 'AUTH',
          status: 403,
        }));
      }

      return Promise.resolve([]);
    });

    await expect(financeLedgerService.syncLocalAndRemote()).resolves.toEqual({
      downloaded: 1,
      uploaded: 0,
    });
    expect(financeLedgerService.getBootstrappedExpenseRecords()).toHaveLength(1);
    expect(financeLedgerService.getBootstrappedIncomeRecords()).toEqual([]);
  });

  it('keeps ledger sync successful when the optional income endpoint fails unexpectedly', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation((collectionName) => {
      if (collectionName === 'finance_expense_records') {
        return Promise.resolve([{
          amount: 18.5,
          category: 'packaging',
          created_at: '2026-07-09T10:00:00.000Z',
          custom_category_label: null,
          expense_date: '2026-07-09',
          id: 'expense-1',
          notes: 'test',
          source: 'manual',
          source_entity_id: null,
          status: 'paid',
          title: '包装袋',
          updated_at: '2026-07-09T10:00:00.000Z',
        }]);
      }

      if (collectionName === 'finance_income_records') {
        return Promise.reject(new AppError('PocketBase 服务暂时不可用，请稍后重试。', {
          code: 'HTTP',
          status: 500,
        }));
      }

      return Promise.resolve([]);
    });

    await expect(financeLedgerService.syncLocalAndRemote()).resolves.toEqual({
      downloaded: 1,
      uploaded: 0,
    });
    expect(financeLedgerService.getBootstrappedIncomeRecords()).toEqual([]);
  });

  it('shows a setup error when saving income before the income collection exists', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    vi.spyOn(PocketBaseRestClient.prototype, 'insert').mockRejectedValue(
      new AppError('集合不存在', {
        code: 'DATA',
        status: 404,
      }),
    );

    await expect(financeLedgerService.saveIncomeRecord({
      amount: 128,
      channel: 'retail',
      incomeDate: '2026-07-09',
      notes: null,
      status: 'received',
      title: '零售收入',
    })).rejects.toMatchObject({
      code: 'BUSINESS',
      message: '收入记录保存失败：远端 finance_income_records 集合或主业务 BFF 白名单尚未就绪，请同步最新服务端配置。',
    });
  });

  it('deletes manual expense records from PocketBase and local snapshot', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation((collectionName) => {
      if (collectionName === 'finance_expense_records') {
        return Promise.resolve([
          {
            amount: 18.5,
            category: 'packaging',
            created_at: '2026-07-09T10:00:00.000Z',
            custom_category_label: null,
            expense_date: '2026-07-09',
            id: 'expense-1',
            notes: 'test',
            source: 'manual',
            source_entity_id: null,
            status: 'paid',
            title: '包装袋',
            updated_at: '2026-07-09T10:00:00.000Z',
          },
          {
            amount: 32,
            category: 'shipping',
            created_at: '2026-07-08T10:00:00.000Z',
            custom_category_label: null,
            expense_date: '2026-07-08',
            id: 'expense-2',
            notes: 'to delete',
            source: 'manual',
            source_entity_id: null,
            status: 'paid',
            title: '快递费',
            updated_at: '2026-07-08T10:00:00.000Z',
          },
        ]);
      }

      return Promise.resolve([]);
    });

    const deleteSpy = vi.spyOn(PocketBaseRestClient.prototype, 'delete').mockResolvedValue(undefined);

    await financeLedgerService.listExpenseRecords();
    await financeLedgerService.deleteExpenseRecord('expense-2');

    expect(deleteSpy).toHaveBeenCalledWith('finance_expense_records', {
      match: {
        id: 'expense-2',
      },
    });
    expect(financeLedgerService.getBootstrappedExpenseRecords()).toMatchObject([
      {
        id: 'expense-1',
        title: '包装袋',
      },
    ]);
  });

  it('deletes manual income records from PocketBase and local snapshot', async () => {
    pocketBaseConnectionSettingsService.save({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: '2026-07-09T12:00:00.000Z',
    });

    vi.spyOn(PocketBaseRestClient.prototype, 'list').mockImplementation((collectionName) => {
      if (collectionName === 'finance_income_records') {
        return Promise.resolve([
          {
            amount: 128,
            channel: 'retail',
            created_at: '2026-07-09T10:00:00.000Z',
            id: 'income-1',
            income_date: '2026-07-09',
            notes: 'keep',
            status: 'received',
            title: '零售收入',
            updated_at: '2026-07-09T10:00:00.000Z',
          },
          {
            amount: 360,
            channel: 'wholesale',
            created_at: '2026-07-08T10:00:00.000Z',
            id: 'income-2',
            income_date: '2026-07-08',
            notes: 'to delete',
            status: 'received',
            title: '批发收入',
            updated_at: '2026-07-08T10:00:00.000Z',
          },
        ]);
      }

      return Promise.resolve([]);
    });

    const deleteSpy = vi.spyOn(PocketBaseRestClient.prototype, 'delete').mockResolvedValue(undefined);

    await financeLedgerService.listIncomeRecords();
    await financeLedgerService.deleteIncomeRecord('income-2');

    expect(deleteSpy).toHaveBeenCalledWith('finance_income_records', {
      match: {
        id: 'income-2',
      },
    });
    expect(financeLedgerService.getBootstrappedIncomeRecords()).toMatchObject([
      {
        id: 'income-1',
        title: '零售收入',
      },
    ]);
  });
});
