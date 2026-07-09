import { beforeEach, describe, expect, it, vi } from 'vitest';

import { financeLedgerService } from '@/modules/finance/services';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';
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
});
