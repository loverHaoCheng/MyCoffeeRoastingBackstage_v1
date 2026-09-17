import { AppError } from '@/shared/errors/AppError';

import type { UserDataBackupFile, UserDataBackupImportOptions, UserDataBackupImportResult, UserDataBackupImportStrategy } from './backup/backup-types';
import { BACKUP_SCHEMA, BACKUP_VERSION, MAX_BACKUP_FILE_BYTES, backupCollections } from './backup/backup-constants';
import { parseBackupFile } from './backup/backup-validators';
import { createBackupImportContext } from './backup/backup-record-transformers';
import { createClient, deleteRecordsMissingFromBackup, importBackupRecord, listBackupCollectionRecords } from './backup/backup-repository';
import { downloadTextFile, getBackupFileName, getCurrentUserEmail, getCurrentUserId, resolveBackupImportMode } from './backup/backup-utils';

export type { UserDataBackupFile, UserDataBackupImportOptions, UserDataBackupImportResult, UserDataBackupImportStrategy };

export const userDataBackupService = {
  async createBackup(): Promise<UserDataBackupFile> {
    const client = createClient();
    const collections: UserDataBackupFile['collections'] = {};
    const summary: UserDataBackupFile['summary'] = {};

    for (const collectionName of backupCollections) {
      const records = await listBackupCollectionRecords(client, collectionName, {
        limit: 10_000,
      });

      collections[collectionName] = records;
      summary[collectionName] = records.length;
    }

    return {
      collections,
      exportedBy: getCurrentUserId()
        ? {
            email: getCurrentUserEmail(),
            id: getCurrentUserId(),
          }
        : undefined,
      exportedAt: new Date().toISOString(),
      schema: BACKUP_SCHEMA,
      summary,
      version: BACKUP_VERSION,
    };
  },

  downloadBackup(backup: UserDataBackupFile): void {
    downloadTextFile(getBackupFileName(backup.exportedAt), JSON.stringify(backup, null, 2));
  },

  getImportMode(backup: UserDataBackupFile): 'merge-account' | 'same-account' {
    return resolveBackupImportMode(backup);
  },

  async importBackup(
    backup: UserDataBackupFile,
    options: UserDataBackupImportOptions = {},
  ): Promise<UserDataBackupImportResult> {
    const client = createClient();
    const idMaps: UserDataBackupFile['collections'] extends Partial<Record<infer K, unknown>> ? Partial<Record<K, Map<string, string>>> : never = {};
    const context = createBackupImportContext(backup);
    const mode = resolveBackupImportMode(backup);
    const effectiveStrategy: UserDataBackupImportStrategy =
      mode === 'same-account' ? options.strategy ?? 'merge' : 'merge';
    let deleted = 0;
    let imported = 0;
    let skipped = 0;
    let updated = 0;

    if (effectiveStrategy === 'sync') {
      deleted = await deleteRecordsMissingFromBackup(client, backup);
    }

    for (const collectionName of backupCollections) {
      const records = backup.collections[collectionName] ?? [];

      for (const record of records) {
        const result = await importBackupRecord(client, collectionName, record, idMaps, context, mode, effectiveStrategy);

        if (result === 'imported') {
          imported += 1;
        } else if (result === 'updated') {
          updated += 1;
        } else {
          skipped += 1;
        }
      }
    }

    return {
      deleted,
      imported,
      skipped,
      updated,
    };
  },

  async readBackupFile(file: File): Promise<UserDataBackupFile> {
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      throw new AppError('备份文件超过 20MB，请拆分数据后重试。', { code: 'DATA' });
    }

    const content = await file.text();
    let payload: unknown;

    try {
      payload = JSON.parse(content) as unknown;
    } catch (error) {
      throw new AppError('备份文件不是有效 JSON。', { code: 'DATA', cause: error });
    }

    return parseBackupFile(payload);
  },
};
