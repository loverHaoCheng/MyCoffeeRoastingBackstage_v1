import { AppError } from '@/shared/errors/AppError';
import { PocketBaseRestClient } from '@/shared/services/pocketBaseRestClient';

import type {
  BackupCollectionName,
  BackupIdMaps,
  BackupImportContext,
  BackupImportMode,
  BackupRecord,
  UserDataBackupFile,
  UserDataBackupImportStrategy,
} from './backup-types';
import { backupCollections, optionalBackupCollections } from './backup-constants';
import {
  isDuplicateRecordImportError,
  isMissingLegacyRoasterModelError,
  isOptionalBackupCollectionListError,
  isOptionalBackupCollectionUnavailableError,
} from './backup-validators';
import {
  omitRecordId,
  registerImportedId,
  rewriteRecordReferences,
  withCurrentPurchaseBatchVersion,
  withLegacyRoasterModelFallback,
} from './backup-record-transformers';
import { getBackupCollectionRecordIds } from './backup-utils';

export const createClient = (): PocketBaseRestClient => {
  return new PocketBaseRestClient({ projectUrl: window.location.origin });
};

export const listBackupCollectionRecords = async (
  client: PocketBaseRestClient,
  collectionName: BackupCollectionName,
  options: {
    limit?: number;
    match?: Record<string, boolean | number | string>;
  } = {},
): Promise<BackupRecord[]> => {
  try {
    return await client.list<BackupRecord>(collectionName, {
      ...options,
      orderBy: {
        ascending: true,
        column: 'created_at',
      },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === 'HTTP' && error.status === 400) {
      try {
        return await client.list<BackupRecord>(collectionName, options);
      } catch (fallbackError) {
        if (isOptionalBackupCollectionListError(collectionName, fallbackError)) {
          return [];
        }

        throw fallbackError;
      }
    }

    if (isOptionalBackupCollectionListError(collectionName, error)) {
      return [];
    }

    throw error;
  }
};

export const getInsertedRecordId = (rows: BackupRecord[], fallback: string): string => {
  const insertedId = rows[0]?.id;

  return typeof insertedId === 'string' && insertedId.length > 0 ? insertedId : fallback;
};

const deleteBackupRecord = async (
  client: PocketBaseRestClient,
  collectionName: BackupCollectionName,
  recordId: string,
): Promise<'deleted' | 'skipped'> => {
  try {
    await client.delete(collectionName, {
      match: {
        id: recordId,
      },
    });

    return 'deleted';
  } catch (error) {
    if (isOptionalBackupCollectionUnavailableError(collectionName, error)) {
      return 'skipped';
    }

    throw error;
  }
};

export const deleteRecordsMissingFromBackup = async (
  client: PocketBaseRestClient,
  backup: UserDataBackupFile,
): Promise<number> => {
  let deleted = 0;

  for (const collectionName of [...backupCollections].reverse()) {
    if (!backup.collections[collectionName]) {
      continue;
    }

    const backupIds = getBackupCollectionRecordIds(backup, collectionName);
    const currentRecords = await listBackupCollectionRecords(client, collectionName, {
      limit: 10_000,
    });

    for (const record of currentRecords) {
      const recordId = typeof record.id === 'string' ? record.id : '';

      if (!recordId || backupIds.has(recordId)) {
        continue;
      }

      const result = await deleteBackupRecord(client, collectionName, recordId);

      if (result === 'deleted') {
        deleted += 1;
      }
    }
  }

  return deleted;
};

export const importBackupRecord = async (
  client: PocketBaseRestClient,
  collectionName: BackupCollectionName,
  record: BackupRecord,
  idMaps: BackupIdMaps,
  context: BackupImportContext,
  mode: BackupImportMode,
  strategy: UserDataBackupImportStrategy,
): Promise<'imported' | 'skipped' | 'updated'> => {
  const oldId = typeof record.id === 'string' ? record.id : '';

  if (mode === 'same-account' && oldId) {
    let existingRecords: BackupRecord[] = [];

    try {
      existingRecords = await listBackupCollectionRecords(client, collectionName, {
        limit: 1,
        match: {
          id: oldId,
        },
      });
    } catch (error) {
      if (isOptionalBackupCollectionUnavailableError(collectionName, error)) {
        return 'skipped';
      }

      throw error;
    }

    if (existingRecords.length > 0) {
      const existingRecord = existingRecords[0];

      if (!existingRecord) {
        throw new AppError('未找到需要更新的备份记录。', { code: 'DATA' });
      }

      registerImportedId(idMaps, collectionName, oldId, oldId);

      if (strategy === 'merge') {
        return 'skipped';
      }

      const payload = withCurrentPurchaseBatchVersion(
        collectionName,
        omitRecordId(rewriteRecordReferences(collectionName, record, idMaps)),
        existingRecord,
      );

      try {
        await client.update<BackupRecord>(collectionName, payload, {
          match: {
            id: oldId,
          },
          select: '*',
        });

        return 'updated';
      } catch (error) {
        if (isOptionalBackupCollectionUnavailableError(collectionName, error)) {
          return 'skipped';
        }

        if (isMissingLegacyRoasterModelError(error)) {
          const fallbackPayload = withLegacyRoasterModelFallback(collectionName, payload, record, context);

          if (fallbackPayload) {
            await client.update<BackupRecord>(collectionName, fallbackPayload, {
              match: {
                id: oldId,
              },
              select: '*',
            });

            return 'updated';
          }
        }

        throw error;
      }
    }
  }

  const payload = mode === 'merge-account'
    ? omitRecordId(rewriteRecordReferences(collectionName, record, idMaps))
    : rewriteRecordReferences(collectionName, record, idMaps);

  try {
    const rows = await client.insert<BackupRecord>(collectionName, payload);

    if (oldId) {
      const insertedId = getInsertedRecordId(rows, mode === 'same-account' ? oldId : '');

      if (!insertedId) {
        throw new AppError('备份导入失败：PocketBase 未返回新记录 ID。', { code: 'DATA' });
      }

      registerImportedId(idMaps, collectionName, oldId, insertedId);
    }

    return 'imported';
  } catch (error) {
    if (isOptionalBackupCollectionUnavailableError(collectionName, error)) {
      return 'skipped';
    }

    if (isMissingLegacyRoasterModelError(error)) {
      const fallbackPayload = withLegacyRoasterModelFallback(collectionName, payload, record, context);

      if (fallbackPayload) {
        const rows = await client.insert<BackupRecord>(collectionName, fallbackPayload);

        if (oldId) {
          const insertedId = getInsertedRecordId(rows, mode === 'same-account' ? oldId : '');

          if (!insertedId) {
            throw new AppError('备份导入失败：PocketBase 未返回新记录 ID。', { code: 'DATA' });
          }

          registerImportedId(idMaps, collectionName, oldId, insertedId);
        }

        return 'imported';
      }
    }

    if (mode === 'same-account' && oldId && isDuplicateRecordImportError(error)) {
      try {
        const rows = await client.insert<BackupRecord>(collectionName, omitRecordId(payload));
        const insertedId = getInsertedRecordId(rows, '');

        if (!insertedId) {
          throw new AppError('备份导入失败：PocketBase 未返回新记录 ID。', { code: 'DATA' });
        }

        registerImportedId(idMaps, collectionName, oldId, insertedId);
        return 'imported';
      } catch (retryError) {
        if (isOptionalBackupCollectionUnavailableError(collectionName, retryError)) {
          return 'skipped';
        }

        throw retryError;
      }
    }

    throw error;
  }
};
