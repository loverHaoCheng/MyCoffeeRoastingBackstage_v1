import { AppError } from '@/shared/errors/AppError';

import type { BackupCollectionName, BackupIdMaps, BackupImportContext, BackupRecord, UserDataBackupFile } from './backup-types';
import { clearWhenRelationTargetMissing, importOmittedFields, relationFieldMappings } from './backup-constants';
import { getTrimmedStringField, rewriteAppSettingKey } from './backup-utils';

export const sanitizeRecordForImport = (record: BackupRecord): BackupRecord => {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !importOmittedFields.has(key)));
};

export const normalizeCollectionPayloadForImport = (
  collectionName: BackupCollectionName,
  payload: BackupRecord,
): BackupRecord => {
  if (collectionName !== 'roasting_machines') {
    return payload;
  }

  return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'model_id'));
};

export const omitRecordId = (record: BackupRecord): BackupRecord => {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'id'));
};

export const withCurrentPurchaseBatchVersion = (
  collectionName: BackupCollectionName,
  payload: BackupRecord,
  currentRecord: BackupRecord,
): BackupRecord => {
  if (collectionName !== 'green_bean_purchase_batches') {
    return payload;
  }

  const expectedUpdatedAt = getTrimmedStringField(currentRecord, 'updated_at');

  if (!expectedUpdatedAt) {
    throw new AppError('采购批次缺少版本信息，无法安全恢复备份。', { code: 'DATA' });
  }

  return {
    ...payload,
    __expected_updated_at: expectedUpdatedAt,
  };
};

export const registerImportedId = (
  idMaps: BackupIdMaps,
  collectionName: BackupCollectionName,
  oldId: string,
  newId: string,
): void => {
  const collectionMap = idMaps[collectionName] ?? new Map<string, string>();

  collectionMap.set(oldId, newId);
  idMaps[collectionName] = collectionMap;
};

export const getMappedId = (
  idMaps: BackupIdMaps,
  collectionName: BackupCollectionName,
  value: unknown,
): {
  mapped: unknown;
  resolved: boolean;
} => {
  if (typeof value !== 'string') {
    return {
      mapped: value,
      resolved: true,
    };
  }

  const mapped = idMaps[collectionName]?.get(value);

  return {
    mapped: mapped ?? value,
    resolved: typeof mapped === 'string',
  };
};

export const createBackupImportContext = (backup: UserDataBackupFile): BackupImportContext => {
  const roasterModelLabels = new Map<string, string>();

  (backup.collections.roasting_machines ?? []).forEach((record) => {
    const id = getTrimmedStringField(record, 'id');
    const label =
      getTrimmedStringField(record, 'display_name') ||
      getTrimmedStringField(record, 'model_key') ||
      getTrimmedStringField(record, 'model_id');

    if (id && label) {
      roasterModelLabels.set(id, label);
    }
  });

  return {
    roasterModelLabels,
  };
};

export const resolveLegacyRoasterModelLabel = (
  record: BackupRecord,
  context: BackupImportContext,
): string => {
  const explicitLabel = getTrimmedStringField(record, 'roaster_model') || getTrimmedStringField(record, 'roasterModel');

  if (explicitLabel) {
    return explicitLabel;
  }

  const machineId = getTrimmedStringField(record, 'roaster_machine_id');

  return context.roasterModelLabels.get(machineId) ?? '';
};

export const withLegacyRoasterModelFallback = (
  collectionName: BackupCollectionName,
  payload: BackupRecord,
  record: BackupRecord,
  context: BackupImportContext,
): BackupRecord | null => {
  if (collectionName !== 'roast_profiles' || typeof payload.roaster_model === 'string' && payload.roaster_model.trim()) {
    return null;
  }

  const roasterModel = resolveLegacyRoasterModelLabel(record, context);

  if (!roasterModel) {
    return null;
  }

  return {
    ...Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'roaster_machine_id')),
    roaster_model: roasterModel,
  };
};

export const rewriteRecordReferences = (
  collectionName: BackupCollectionName,
  record: BackupRecord,
  idMaps: BackupIdMaps,
): BackupRecord => {
  let payload = normalizeCollectionPayloadForImport(collectionName, sanitizeRecordForImport(record));
  const fieldMappings = relationFieldMappings[collectionName] ?? {};

  Object.entries(fieldMappings).forEach(([fieldName, targetCollectionName]) => {
    if (!targetCollectionName) {
      return;
    }

    const sourceValue = payload[fieldName];
    const { mapped, resolved } = getMappedId(idMaps, targetCollectionName, sourceValue);

    if (
      typeof sourceValue === 'string' &&
      sourceValue.length > 0 &&
      !resolved &&
      clearWhenRelationTargetMissing.has(`${collectionName}.${fieldName}`)
    ) {
      payload = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== fieldName));
      return;
    }

    payload[fieldName] = mapped;
  });

  if (collectionName === 'app_settings' && typeof payload.key === 'string') {
    payload.key = rewriteAppSettingKey(payload.key, idMaps);
  }

  return payload;
};
