import { getShanghaiDateParts } from '@/shared/time/shanghaiTime';
import { pocketBaseSessionService } from '@/shared/services/pocketBaseSession.service';

import type { BackupCollectionName, BackupIdMaps, BackupRecord, UserDataBackupFile } from './backup-types';

export const getTrimmedStringField = (record: BackupRecord, fieldName: string): string => {
  const value = record[fieldName];

  return typeof value === 'string' ? value.trim() : '';
};

export const getCurrentUserId = (): string => {
  return pocketBaseSessionService.getUser()?.id.trim() ?? '';
};

export const getCurrentUserEmail = (): string | undefined => {
  const user = pocketBaseSessionService.getUser();

  if (!user) {
    return undefined;
  }

  const email = user.email.trim();

  if (!email) {
    return undefined;
  }

  return email;
};

export const collectBackupOwnerIds = (backup: UserDataBackupFile): Set<string> => {
  const ownerIds = new Set<string>();

  if (backup.exportedBy?.id) {
    ownerIds.add(backup.exportedBy.id);
  }

  Object.values(backup.collections).forEach((records) => {
    records.forEach((record) => {
      const ownerId = getTrimmedStringField(record, 'owner');

      if (ownerId) {
        ownerIds.add(ownerId);
      }
    });
  });

  return ownerIds;
};

export const resolveBackupImportMode = (backup: UserDataBackupFile): 'merge-account' | 'same-account' => {
  const currentUserId = getCurrentUserId();

  if (!currentUserId) {
    return 'merge-account';
  }

  const ownerIds = collectBackupOwnerIds(backup);

  return ownerIds.size === 1 && ownerIds.has(currentUserId) ? 'same-account' : 'merge-account';
};

export const getBackupCollectionRecordIds = (
  backup: UserDataBackupFile,
  collectionName: BackupCollectionName,
): Set<string> => {
  return new Set(
    (backup.collections[collectionName] ?? [])
      .map((record) => record.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
};

export const getBackupFileName = (exportedAt: string): string => {
  const parts = getShanghaiDateParts(exportedAt);
  const timestamp = parts
    ? `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`
    : exportedAt.replace(/\D/g, '').slice(0, 14);

  return `easybake-backup-${timestamp || 'unknown'}.json`;
};

export const downloadTextFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
};

export const rewriteAppSettingKey = (key: string, idMaps: BackupIdMaps): string => {
  const prefixes: { collectionName: BackupCollectionName; prefix: string }[] = [
    { collectionName: 'green_beans', prefix: 'green_bean_sale_defaults:' },
    { collectionName: 'green_beans', prefix: 'green_bean_cost_template:' },
    { collectionName: 'green_beans', prefix: 'green_bean_grade:' },
  ];

  for (const { collectionName, prefix } of prefixes) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    const oldId = key.slice(prefix.length);
    const newId = idMaps[collectionName]?.get(oldId);

    return newId ? `${prefix}${newId}` : key;
  }

  return key;
};
