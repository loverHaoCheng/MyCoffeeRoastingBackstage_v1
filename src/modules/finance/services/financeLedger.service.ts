import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';
import type { ApiResponse } from '@/services/api.types';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

import type {
  FinanceExpenseFormInput,
  FinanceExpenseRecord,
  FinanceIncomeFormInput,
  FinanceIncomeRecord,
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
  roast_batch_ids?: string[];
  source: FinanceExpenseRecord['source'];
  source_entity_id: null | string;
  status: FinanceExpenseRecord['status'];
  title: string;
  updated_at: string;
}

interface RemoteFinanceIncomeRecord {
  amount: number;
  channel: FinanceIncomeRecord['channel'];
  created_at: string;
  id: string;
  income_date: string;
  notes: null | string;
  source?: FinanceIncomeRecord['source'];
  source_entity_id?: null | string;
  status: FinanceIncomeRecord['status'];
  title: string;
  updated_at: string;
}

const EXPENSE_COLLECTION = 'finance_expense_records';
const INCOME_COLLECTION = 'finance_income_records';

let currentExpenseRecords: FinanceExpenseRecord[] = [];
let currentIncomeRecords: FinanceIncomeRecord[] = [];

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
  roastBatchIds: input.roastBatchIds ?? [],
  title: input.title.trim(),
});

const normalizeIncomeInput = (input: FinanceIncomeFormInput): FinanceIncomeFormInput => ({
  ...input,
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

const setCurrentIncomeRecords = (records: FinanceIncomeRecord[]): FinanceIncomeRecord[] => {
  currentIncomeRecords = sortByUpdatedAt(records);
  return currentIncomeRecords;
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
  roastBatchIds: record.roast_batch_ids ?? [],
  source: record.source,
  sourceEntityId: record.source_entity_id,
  status: record.status,
  title: record.title,
  updatedAt: record.updated_at,
});

const mapRemoteIncomeRecord = (record: RemoteFinanceIncomeRecord): FinanceIncomeRecord => ({
  amount: record.amount,
  channel: record.channel,
  createdAt: record.created_at,
  id: record.id,
  incomeDate: record.income_date,
  notes: record.notes,
  source: record.source ?? 'manual',
  sourceEntityId: record.source_entity_id ?? null,
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
    roast_batch_ids: normalizedInput.roastBatchIds ?? [],
    source: 'manual' as const,
    source_entity_id: null,
    status: normalizedInput.status,
    title: normalizedInput.title.trim(),
    updated_at: timestamps.updatedAt,
  };
};

const mapIncomeInputToRemotePayload = (input: FinanceIncomeFormInput) => {
  const timestamps = createLedgerTimestamps();
  const normalizedInput = normalizeIncomeInput(input);

  return {
    amount: normalizedInput.amount,
    channel: normalizedInput.channel,
    created_at: timestamps.createdAt,
    income_date: normalizedInput.incomeDate,
    notes: normalizeText(normalizedInput.notes),
    status: normalizedInput.status,
    title: normalizedInput.title.trim(),
    updated_at: timestamps.updatedAt,
  };
};

const resolveLedgerConnectionCandidates = (): FinanceLedgerConnectionCandidate[] => {
  return [{
    client: new PocketBaseRestClient({
      projectUrl: '',
      publishableKey: '',
    }),
  }];
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

const createMissingIncomeCollectionError = (): AppError => {
  return new AppError(
    '收入记录保存失败：远端 finance_income_records 集合或主业务 BFF 白名单尚未就绪，请同步最新服务端配置。',
    {
      code: 'BUSINESS',
    },
  );
};

export const financeLedgerService = {
  clear(): void {
    currentExpenseRecords = [];
    currentIncomeRecords = [];
  },
  getBootstrappedExpenseRecords(): FinanceExpenseRecord[] {
    return currentExpenseRecords;
  },
  getBootstrappedIncomeRecords(): FinanceIncomeRecord[] {
    return currentIncomeRecords;
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
  async listIncomeRecords(): Promise<ApiResponse<FinanceIncomeRecord[]>> {
    const candidates = resolveLedgerConnectionCandidates();

    if (candidates.length === 0) {
      throw new AppError('PocketBase 连接配置缺失。', { code: 'CONFIG' });
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const response = await createRemoteLedgerRepository(candidate.client).listIncomeRecords();
        setCurrentIncomeRecords(response.data);
        return response;
      } catch (error) {
        lastError = error;

        logger.warn('finance income list unavailable', { error });
        setCurrentIncomeRecords([]);
        return ok([]);
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
  async saveIncomeRecord(input: FinanceIncomeFormInput): Promise<ApiResponse<FinanceIncomeRecord>> {
    const candidates = resolveLedgerConnectionCandidates();

    if (candidates.length === 0) {
      throw new AppError('PocketBase 连接配置缺失。', { code: 'CONFIG' });
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const response = await createRemoteLedgerRepository(candidate.client).saveIncomeRecord(input);
        setCurrentIncomeRecords([response.data, ...currentIncomeRecords.filter((record) => record.id !== response.data.id)]);
        return response;
      } catch (error) {
        lastError = error;

        if (!isMissingRemoteResourceError(error)) {
          break;
        }

        logger.warn('finance income save missing remote table', { error });
        throw createMissingIncomeCollectionError();
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
  async deleteIncomeRecord(incomeRecordId: string): Promise<void> {
    const candidates = resolveLedgerConnectionCandidates();

    if (candidates.length === 0) {
      throw new AppError('PocketBase 连接配置缺失。', { code: 'CONFIG' });
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new AppError('当前网络不可用，无法删除收入记录。', { code: 'NETWORK' });
    }

    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        await candidate.client.delete(INCOME_COLLECTION, {
          match: {
            id: incomeRecordId,
          },
        });

        setCurrentIncomeRecords(currentIncomeRecords.filter((record) => record.id !== incomeRecordId));
        return;
      } catch (error) {
        lastError = error;

        if (!isMissingRemoteResourceError(error)) {
          break;
        }

        logger.warn('finance income delete missing remote table', { error });
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
        const beforeExpenseSignature = getLedgerSyncSnapshot(currentExpenseRecords);
        const beforeIncomeSignature = getLedgerSyncSnapshot(currentIncomeRecords);
        const remoteExpenses = await repository.listExpenseRecords();
        let remoteIncomes: ApiResponse<FinanceIncomeRecord[]>;

        try {
          remoteIncomes = await repository.listIncomeRecords();
        } catch (error) {
          logger.warn('finance income sync unavailable', { error });
          remoteIncomes = ok([]);
        }

        setCurrentExpenseRecords(remoteExpenses.data);
        setCurrentIncomeRecords(remoteIncomes.data);
        const afterExpenseSignature = getLedgerSyncSnapshot(currentExpenseRecords);
        const afterIncomeSignature = getLedgerSyncSnapshot(currentIncomeRecords);

        return {
          downloaded:
            beforeExpenseSignature === afterExpenseSignature && beforeIncomeSignature === afterIncomeSignature
              ? 0
              : currentExpenseRecords.length + currentIncomeRecords.length,
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
