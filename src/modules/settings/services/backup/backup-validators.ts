import { AppError } from '@/shared/errors/AppError';

import type { BackupCollectionName, BackupRecord, UserDataBackupFile } from './backup-types';
import { BACKUP_SCHEMA, BACKUP_VERSION, backupCollections, optionalBackupCollections } from './backup-constants';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isBackupCollectionName = (value: string): value is BackupCollectionName => {
  return backupCollections.includes(value as BackupCollectionName);
};

const stringifyErrorCause = (cause: unknown): string => {
  if (typeof cause === 'string') {
    return cause;
  }

  if (cause === undefined) {
    return '';
  }

  try {
    return JSON.stringify(cause);
  } catch {
    return '';
  }
};

const getNormalizedErrorText = (error: AppError): string => {
  return `${error.message} ${stringifyErrorCause(error.cause)}`.toLowerCase();
};

export const isOptionalBackupCollectionUnavailableError = (
  collectionName: BackupCollectionName,
  error: unknown,
): boolean => {
  if (!optionalBackupCollections.has(collectionName) || !(error instanceof AppError)) {
    return false;
  }

  if (error.status === 404 && (error.code === 'HTTP' || error.code === 'AUTH')) {
    return true;
  }

  const normalizedText = getNormalizedErrorText(error);

  if (error.status === 403 && error.code === 'AUTH') {
    return (
      normalizedText.includes('collection') ||
      normalizedText.includes('forbidden') ||
      normalizedText.includes('permission') ||
      normalizedText.includes('access') ||
      normalizedText.includes('开放') ||
      normalizedText.includes('权限') ||
      normalizedText.includes('不允许')
    );
  }

  if (error.code !== 'HTTP' || error.status !== 400) {
    return false;
  }

  return (
    normalizedText.includes('collection') ||
    normalizedText.includes('not found') ||
    normalizedText.includes('does not exist') ||
    normalizedText.includes('unknown') ||
    normalizedText.includes('不存在') ||
    normalizedText.includes('未初始化')
  );
};

export const isOptionalBackupCollectionListError = (
  collectionName: BackupCollectionName,
  error: unknown,
): boolean => {
  return (
    optionalBackupCollections.has(collectionName) &&
    error instanceof AppError &&
    (
      (error.code === 'HTTP' && (error.status === 400 || error.status === 404)) ||
      (error.code === 'AUTH' && error.status === 403 && isOptionalBackupCollectionUnavailableError(collectionName, error))
    )
  );
};

export const isDuplicateRecordImportError = (error: unknown): boolean => {
  if (!(error instanceof AppError) || (error.status !== 400 && error.status !== 409)) {
    return false;
  }

  const normalizedMessage = getNormalizedErrorText(error);

  return (
    normalizedMessage.includes('already exists') ||
    normalizedMessage.includes('must be unique') ||
    normalizedMessage.includes('validation_not_unique') ||
    normalizedMessage.includes('已存在')
  );
};

export const isMissingLegacyRoasterModelError = (error: unknown): boolean => {
  if (!(error instanceof AppError) || error.status !== 400) {
    return false;
  }

  const normalizedMessage = getNormalizedErrorText(error);

  return (
    normalizedMessage.includes('roaster_model') ||
    normalizedMessage.includes('roastermodel') ||
    normalizedMessage.includes('roaster model') ||
    normalizedMessage.includes('烘豆机')
  ) && (
    normalizedMessage.includes('required') ||
    normalizedMessage.includes('不能为空') ||
    normalizedMessage.includes('missing required value')
  );
};

export const parseBackupFile = (payload: unknown): UserDataBackupFile => {
  if (!isRecord(payload)) {
    throw new AppError('备份文件格式错误：根元素必须是对象。', { code: 'DATA' });
  }

  if (payload.schema !== BACKUP_SCHEMA) {
    throw new AppError(`备份文件格式错误：预期 schema="${BACKUP_SCHEMA}"，实际是 "${String(payload.schema)}"。`, {
      code: 'DATA',
    });
  }

  if (payload.version !== BACKUP_VERSION) {
    throw new AppError(`备份文件版本错误：预期 version=${BACKUP_VERSION}，实际是 ${String(payload.version)}。`, {
      code: 'DATA',
    });
  }

  if (!isRecord(payload.collections)) {
    throw new AppError('备份文件格式错误：collections 必须是对象。', { code: 'DATA' });
  }

  if (!isRecord(payload.summary)) {
    throw new AppError('备份文件格式错误：summary 必须是对象。', { code: 'DATA' });
  }

  if (typeof payload.exportedAt !== 'string') {
    throw new AppError('备份文件格式错误：exportedAt 必须是字符串。', { code: 'DATA' });
  }

  return payload as unknown as UserDataBackupFile;
};
