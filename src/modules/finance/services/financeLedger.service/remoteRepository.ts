import { AppError } from '@/shared/errors/AppError';
import type { ApiResponse } from '@/shared/services/api.types';
import { ok as createOkResponse } from '@/shared/services/apiResponse.utils';
import type { PocketBaseRestClient } from '@/shared/services/pocketBaseRestClient';
import type { FinanceExpenseFormInput, FinanceExpenseRecord, FinanceIncomeFormInput, FinanceIncomeRecord } from '../../types';
import { mapExpenseInputToRemotePayload, mapIncomeInputToRemotePayload } from './payloadMappers';
import { mapRemoteExpenseRecord, mapRemoteIncomeRecord } from './recordMappers';
import type { RemoteFinanceExpenseRecord, RemoteFinanceIncomeRecord } from './types';
import { EXPENSE_COLLECTION, INCOME_COLLECTION } from './types';

const ok = <T,>(data: T): ApiResponse<T> => createOkResponse(data);

export const createRemoteLedgerRepository = (client: Pick<PocketBaseRestClient, 'delete' | 'insert' | 'list'>) => ({
  async listExpenseRecords(): Promise<ApiResponse<FinanceExpenseRecord[]>> {
    const rows = await client.list<RemoteFinanceExpenseRecord>(EXPENSE_COLLECTION, {
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return ok(rows.map(mapRemoteExpenseRecord));
  },
  async listIncomeRecords(): Promise<ApiResponse<FinanceIncomeRecord[]>> {
    const rows = await client.list<RemoteFinanceIncomeRecord>(INCOME_COLLECTION, {
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return ok(rows.map(mapRemoteIncomeRecord));
  },
  async saveExpenseRecord(input: FinanceExpenseFormInput): Promise<ApiResponse<FinanceExpenseRecord>> {
    const rows = await client.insert<RemoteFinanceExpenseRecord>(
      EXPENSE_COLLECTION,
      mapExpenseInputToRemotePayload(input),
      { select: '*' },
    );
    const savedRow = rows[0];

    if (!savedRow) {
      throw new AppError('支出记录保存失败：未返回数据。', { code: 'DATA' });
    }

    return ok(mapRemoteExpenseRecord(savedRow));
  },
  async saveIncomeRecord(input: FinanceIncomeFormInput): Promise<ApiResponse<FinanceIncomeRecord>> {
    const rows = await client.insert<RemoteFinanceIncomeRecord>(
      INCOME_COLLECTION,
      mapIncomeInputToRemotePayload(input),
      { select: '*' },
    );
    const savedRow = rows[0];

    if (!savedRow) {
      throw new AppError('收入记录保存失败：未返回数据。', { code: 'DATA' });
    }

    return ok(mapRemoteIncomeRecord(savedRow));
  },
});
