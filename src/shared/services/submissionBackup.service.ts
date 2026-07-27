import { logger } from '@/shared/logger/logger';

type SubmissionBackupOperation = 'create' | 'update';
type SubmissionBackupScope = 'bean' | 'roastBatch' | 'roastPlan';

interface SubmissionBackupRecord {
  createdAt: string;
  id: string;
  operation: SubmissionBackupOperation;
  payload: unknown;
  scope: SubmissionBackupScope;
}

const DATABASE_NAME = 'easybake-submission-drafts';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drafts';

const getBackupId = (operation: SubmissionBackupOperation, payload: unknown, scope: SubmissionBackupScope): string => {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    const entityId = record.beanId ?? record.batchId ?? record.planId;

    if (typeof entityId === 'number' || typeof entityId === 'string') {
      return `${scope}:${operation}:${String(entityId)}`;
    }
  }

  return `${scope}:${operation}:new`;
};

const openDatabase = (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onerror = () => {
      resolve(null);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

const runRequest = async <T,>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T | undefined>,
): Promise<T | null> => {
  const database = await openDatabase();

  if (!database) {
    return null;
  }

  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));

    request.onerror = () => {
      resolve(null);
    };
    request.onsuccess = () => {
      resolve(request.result ?? null);
    };
    transaction.oncomplete = () => {
      database.close();
    };
    transaction.onerror = () => {
      database.close();
    };
  });
};

export const submissionBackupService = {
  clear(id: string): void {
    void runRequest<undefined>('readwrite', (store) => {
      return store.delete(id);
    }).catch((error: unknown) => {
      logger.warn('submission draft removal failed', { error, id });
    });
  },
  async load<T>(id: string): Promise<T | null> {
    const record = await runRequest<SubmissionBackupRecord>('readonly', (store) => {
      return store.get(id) as IDBRequest<SubmissionBackupRecord | undefined>;
    });

    return record ? (record.payload as T) : null;
  },
  save(operation: SubmissionBackupOperation, payload: unknown, scope: SubmissionBackupScope): string {
    const id = getBackupId(operation, payload, scope);
    const record: SubmissionBackupRecord = {
      createdAt: new Date().toISOString(),
      id,
      operation,
      payload,
      scope,
    };

    void runRequest<undefined>('readwrite', (store) => {
      return store.put(record) as unknown as IDBRequest<undefined>;
    }).catch((error: unknown) => {
      logger.warn('submission draft persistence failed', { error, id, scope });
    });

    return id;
  },
};
