import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';
import type { ApiResponse } from '@/shared/services/api.types';
import { ok as createOkResponse } from '@/shared/services/apiResponse.utils';

import type {
  FinanceExpenseFormInput,
  FinanceExpenseRecord,
  FinanceIncomeFormInput,
  FinanceIncomeRecord,
} from '../types';

import { resolveLedgerConnectionCandidates } from './financeLedger.service/connectionResolver';
import {
  createMissingIncomeCollectionError,
  isIncomeCollectionNotReadyError,
  isMissingRemoteResourceError,
} from './financeLedger.service/errorHandlers';
import {
  clearCurrentRecords,
  getCurrentExpenseRecords,
  getCurrentIncomeRecords,
  getLedgerSyncSnapshot,
  setCurrentExpenseRecords,
  setCurrentIncomeRecords,
} from './financeLedger.service/recordState';
import { createRemoteLedgerRepository } from './financeLedger.service/remoteRepository';
import { EXPENSE_COLLECTION, INCOME_COLLECTION } from './financeLedger.service/types';

const ok = <T,>(data: T): ApiResponse<T> => createOkResponse(data);

export const financeLedgerService = {
  clear(): void {
    clearCurrentRecords();
  },
  getBootstrappedExpenseRecords(): FinanceExpenseRecord[] {
    return getCurrentExpenseRecords();
  },
  getBootstrappedIncomeRecords(): FinanceIncomeRecord[] {
    return getCurrentIncomeRecords();
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

        if (!isIncomeCollectionNotReadyError(error)) {
          break;
        }

        logger.warn('finance income list unavailable: collection not ready', { error });
      }
    }

    if (isIncomeCollectionNotReadyError(lastError)) {
      setCurrentIncomeRecords([]);
      return ok([]);
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
        const currentRecords = getCurrentExpenseRecords();
        setCurrentExpenseRecords([response.data, ...currentRecords.filter((record) => record.id !== response.data.id)]);
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
        const currentRecords = getCurrentIncomeRecords();
        setCurrentIncomeRecords([response.data, ...currentRecords.filter((record) => record.id !== response.data.id)]);
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

        const currentRecords = getCurrentExpenseRecords();
        setCurrentExpenseRecords(currentRecords.filter((record) => record.id !== expenseRecordId));
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

        const currentRecords = getCurrentIncomeRecords();
        setCurrentIncomeRecords(currentRecords.filter((record) => record.id !== incomeRecordId));
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
        const currentExpenses = getCurrentExpenseRecords();
        const currentIncomes = getCurrentIncomeRecords();
        const beforeExpenseSignature = getLedgerSyncSnapshot(currentExpenses);
        const beforeIncomeSignature = getLedgerSyncSnapshot(currentIncomes);
        const remoteExpenses = await repository.listExpenseRecords();
        let remoteIncomes: ApiResponse<FinanceIncomeRecord[]>;

        try {
          remoteIncomes = await repository.listIncomeRecords();
        } catch (error) {
          // 仅集合缺失/权限未就绪时容忍为空；其他错误抛出，避免用空数组覆盖收入数据。
          if (!isIncomeCollectionNotReadyError(error)) {
            throw error;
          }

          logger.warn('finance income sync unavailable: collection not ready', { error });
          remoteIncomes = ok([]);
        }

        setCurrentExpenseRecords(remoteExpenses.data);
        setCurrentIncomeRecords(remoteIncomes.data);
        const updatedExpenses = getCurrentExpenseRecords();
        const updatedIncomes = getCurrentIncomeRecords();
        const afterExpenseSignature = getLedgerSyncSnapshot(updatedExpenses);
        const afterIncomeSignature = getLedgerSyncSnapshot(updatedIncomes);

        return {
          downloaded:
            beforeExpenseSignature === afterExpenseSignature && beforeIncomeSignature === afterIncomeSignature
              ? 0
              : updatedExpenses.length + updatedIncomes.length,
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
