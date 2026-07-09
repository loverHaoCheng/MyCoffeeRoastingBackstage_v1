import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { isPocketBaseProjectConnectionConfigured } from '@/modules/settings/types';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';
import type { ApiResponse } from '@/services/api.types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

import type {
  FinanceExpenseFormInput,
  FinanceExpenseRecord,
} from '../types';

interface FinanceLedgerConnectionCandidate {
  client: Pick<PocketBaseRestClient, 'delete' | 'insert' | 'list'>;
}

interface RemoteFinanceExpenseRecord {
  amount: number;
  category: FinanceExpenseRecord['category'];
  created_at: string;
  custom_category_label: null | string;
  expense_date: string;
  id: string;
  notes: null | string;
  source: FinanceExpenseRecord['source'];
  source_entity_id: null | string;
  status: FinanceExpenseRecord['status'];
  title: string;
  updated_at: string;
}

const EXPENSE_COLLECTION = 'finance_expense_records';

let currentExpenseRecords: FinanceExpenseRecord[] = [];

const ok = <T,>(data: T): ApiResponse<T> => ({
  code: 0,
  data,
  message: 'ok',
});

const normalizeText = (value: null | string | undefined): null | string => {
  const nextValue = value?.trim() ?? '';

  return nextValue.length > 0 ? nextValue : null;
};

const normalizeExpenseInput = (input: FinanceExpenseFormInput): FinanceExpenseFormInput => ({
  ...input,
  customCategoryLabel: normalizeText(input.customCategoryLabel),
  notes: normalizeText(input.notes),
  title: input.title.trim(),
});

const sortByUpdatedAt = <TRecord extends { updatedAt: string }>(records: TRecord[]): TRecord[] => {
  return [...records].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
};

const getLedgerSyncSnapshot = (records: { id: string; updatedAt: string }[]): string => {
  return JSON.stringify(
    [...records]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((record) => `${record.id}:${record.updatedAt}`),
  );
};

const setCurrentExpenseRecords = (records: FinanceExpenseRecord[]): FinanceExpenseRecord[] => {
  currentExpenseRecords = sortByUpdatedAt(records);
  return currentExpenseRecords;
};

const createLedgerTimestamps = (): { createdAt: string; updatedAt: string } => {
  const timestamp = new Date().toISOString();

  return {
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const mapRemoteExpenseRecord = (record: RemoteFinanceExpenseRecord): FinanceExpenseRecord => ({
  amount: record.amount,
  category: record.category,
  createdAt: record.created_at,
  customCategoryLabel: record.custom_category_label,
  expenseDate: record.expense_date,
  id: record.id,
  notes: record.notes,
  source: record.source,
  sourceEntityId: record.source_entity_id,
  status: record.status,
  title: record.title,
  updatedAt: record.updated_at,
});

const mapExpenseInputToRemotePayload = (input: FinanceExpenseFormInput) => {
  const timestamps = createLedgerTimestamps();
  const normalizedInput = normalizeExpenseInput(input);

  return {
    amount: normalizedInput.amount,
    category: normalizedInput.category,
    created_at: timestamps.createdAt,
    custom_category_label: normalizeText(normalizedInput.customCategoryLabel),
    expense_date: normalizedInput.expenseDate,
    notes: normalizeText(normalizedInput.notes),
    source: 'manual' as const,
    source_entity_id: null,
    status: normalizedInput.status,
    title: normalizedInput.title.trim(),
    updated_at: timestamps.updatedAt,
  };
};

const resolveLedgerConnectionCandidates = (): FinanceLedgerConnectionCandidate[] => {
  const greenConnection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');

  if (!isPocketBaseProjectConnectionConfigured(greenConnection)) {
    return [];
  }

  return [{ client: new PocketBaseRestClient(greenConnection) }];
};

const isMissingRemoteResourceError = (error: unknown): boolean => {
  if (!(error instanceof AppError)) {
    return false;
  }

  const cause = error.cause;
  const payload = typeof cause === 'object' && cause != null ? (cause as { code?: string; message?: string }) : null;
  const message = payload?.message ?? error.message;

  return error.status === 404 || payload?.code?.startsWith('PGRST') === true || message.includes('不存在');
};

const createRemoteLedgerRepository = (client: Pick<PocketBaseRestClient, 'delete' | 'insert' | 'list'>) => ({
  async listExpenseRecords(): Promise<ApiResponse<FinanceExpenseRecord[]>> {
    const rows = await client.list<RemoteFinanceExpenseRecord>(EXPENSE_COLLECTION, {
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return ok(rows.map(mapRemoteExpenseRecord));
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
});

export const financeLedgerService = {
  clear(): void {
    currentExpenseRecords = [];
  },
  getBootstrappedExpenseRecords(): FinanceExpenseRecord[] {
    return currentExpenseRecords;
  },
  async listExpenseRecords(): Promise<ApiResponse<FinanceExpenseRecord[]>> {
    const candidates = resolveLedgerConnectionCandidates();

    if (candidates.length === 0) {
      throw new AppError('PocketBase 连接配置缺失。', { code: 'CONFIG' });
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const response = await createRemoteLedgerRepository(candidate.client).listExpenseRecords();
        setCurrentExpenseRecords(response.data);
        return response;
      } catch (error) {
        lastError = error;

        if (!isMissingRemoteResourceError(error)) {
          break;
        }

        logger.warn('finance expense list missing remote table', { error });
      }
    }

    throw lastError;
  },
  async saveExpenseRecord(input: FinanceExpenseFormInput): Promise<ApiResponse<FinanceExpenseRecord>> {
    const candidates = resolveLedgerConnectionCandidates();

    if (candidates.length === 0) {
      throw new AppError('PocketBase 连接配置缺失。', { code: 'CONFIG' });
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const response = await createRemoteLedgerRepository(candidate.client).saveExpenseRecord(input);
        setCurrentExpenseRecords([response.data, ...currentExpenseRecords.filter((record) => record.id !== response.data.id)]);
        return response;
      } catch (error) {
        lastError = error;

        if (!isMissingRemoteResourceError(error)) {
          break;
        }

        logger.warn('finance expense save missing remote table', { error });
      }
    }

    throw lastError;
  },
  async deleteExpenseRecord(expenseRecordId: string): Promise<void> {
    const candidates = resolveLedgerConnectionCandidates();

    if (candidates.length === 0) {
      throw new AppError('PocketBase 连接配置缺失。', { code: 'CONFIG' });
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new AppError('当前网络不可用，无法删除支出记录。', { code: 'NETWORK' });
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        await candidate.client.delete(EXPENSE_COLLECTION, {
          match: {
            id: expenseRecordId,
          },
        });

        setCurrentExpenseRecords(currentExpenseRecords.filter((record) => record.id !== expenseRecordId));
        return;
      } catch (error) {
        lastError = error;

        if (!isMissingRemoteResourceError(error)) {
          break;
        }

        logger.warn('finance expense delete missing remote table', { error });
      }
    }

    throw lastError;
  },
  async syncLocalAndRemote(): Promise<{ downloaded: number; uploaded: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { downloaded: 0, uploaded: 0 };
    }

    const candidates = resolveLedgerConnectionCandidates();

    if (candidates.length === 0) {
      return { downloaded: 0, uploaded: 0 };
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const repository = createRemoteLedgerRepository(candidate.client);
        const remoteExpenses = await repository.listExpenseRecords();
        const beforeSignature = getLedgerSyncSnapshot(currentExpenseRecords);

        setCurrentExpenseRecords(remoteExpenses.data);
        const afterSignature = getLedgerSyncSnapshot(currentExpenseRecords);

        return {
          downloaded: beforeSignature === afterSignature ? 0 : currentExpenseRecords.length,
          uploaded: 0,
        };
      } catch (error) {
        lastError = error;

        if (!isMissingRemoteResourceError(error)) {
          break;
        }

        logger.warn('finance ledger sync missing remote table', { error });
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new AppError('财务台账同步失败。', { code: 'NETWORK', cause: lastError });
  },
};
