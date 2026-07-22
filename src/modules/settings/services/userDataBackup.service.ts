import { getShanghaiDateParts } from '@/shared/time/shanghaiTime';
import { AppError } from '@/shared/errors/AppError';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';
import { pocketBaseSessionService } from '@/services/pocketBaseSession.service';

const backupSchema = 'easybake.user-data-backup';
const backupVersion = 1;

const backupCollections = [
  'green_beans',
  'green_bean_purchase_batches',
  'bean_sale_specs',
  'roasting_machines',
  'roast_profiles',
  'roast_batches',
  'roast_curve_records',
  'roast_records',
  'ai_roast_consents',
  'ai_roast_profiles',
  'ai_roast_reviews',
  'ai_roast_recommendations',
  'ai_roast_feedback',
  'finance_expense_records',
  'finance_income_records',
  'cost_calculations',
  'app_settings',
] as const;

type BackupCollectionName = (typeof backupCollections)[number];

const optionalBackupCollections = new Set<BackupCollectionName>([
  'ai_roast_consents',
  'ai_roast_feedback',
  'ai_roast_profiles',
  'ai_roast_recommendations',
  'ai_roast_reviews',
  'app_settings',
  'bean_sale_specs',
  'cost_calculations',
  'finance_expense_records',
  'finance_income_records',
  'green_bean_purchase_batches',
  'roast_curve_records',
  'roast_records',
  'roasting_machines',
]);

type BackupRecord = Record<string, unknown>;
type BackupIdMaps = Partial<Record<BackupCollectionName, Map<string, string>>>;
interface BackupImportContext {
  roasterModelLabels: Map<string, string>;
}
type BackupImportMode = 'merge-account' | 'same-account';
export type UserDataBackupImportStrategy = 'merge' | 'sync';

export interface UserDataBackupFile {
  collections: Partial<Record<BackupCollectionName, BackupRecord[]>>;
  exportedBy?: {
    email?: string;
    id: string;
  };
  exportedAt: string;
  schema: typeof backupSchema;
  summary: Partial<Record<BackupCollectionName, number>>;
  version: typeof backupVersion;
}

export interface UserDataBackupImportResult {
  deleted: number;
  imported: number;
  skipped: number;
  updated: number;
}

export interface UserDataBackupImportOptions {
  strategy?: UserDataBackupImportStrategy;
}

const createClient = (): PocketBaseRestClient => {
  return new PocketBaseRestClient({ projectUrl: window.location.origin });
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isBackupCollectionName = (value: string): value is BackupCollectionName => {
  return backupCollections.includes(value as BackupCollectionName);
};

const getTrimmedStringField = (record: BackupRecord, fieldName: string): string => {
  const value = record[fieldName];

  return typeof value === 'string' ? value.trim() : '';
};

const getCurrentUserId = (): string => {
  return pocketBaseSessionService.getUser()?.id.trim() ?? '';
};

const getCurrentUserEmail = (): string | undefined => {
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

const importOmittedFields = new Set([
  'collectionId',
  'collectionName',
  'created',
  'created_at',
  'expand',
  'owner',
  'updated',
  'updated_at',
]);

const relationFieldMappings: Partial<Record<BackupCollectionName, Partial<Record<string, BackupCollectionName>>>> = {
  app_settings: {},
  bean_sale_specs: {
    green_bean_id: 'green_beans',
  },
  cost_calculations: {
    bean_id: 'green_beans',
  },
  green_bean_purchase_batches: {
    green_bean_id: 'green_beans',
  },
  roast_batches: {
    green_bean_id: 'green_beans',
    roast_plan_id: 'roast_profiles',
  },
  roast_curve_records: {
    roast_batch_id: 'roast_batches',
  },
  roast_profiles: {
    green_bean_id: 'green_beans',
    roaster_machine_id: 'roasting_machines',
  },
  roast_records: {
    green_bean_id: 'green_beans',
  },
  ai_roast_consents: {
    machine_id: 'roasting_machines',
  },
  ai_roast_feedback: {
    recommendation_id: 'ai_roast_recommendations',
    roast_batch_id: 'roast_batches',
  },
  ai_roast_profiles: {
    machine_id: 'roasting_machines',
  },
  ai_roast_recommendations: {
    machine_id: 'roasting_machines',
  },
  ai_roast_reviews: {
    curve_record_id: 'roast_curve_records',
    machine_id: 'roasting_machines',
    roast_batch_id: 'roast_batches',
  },
};

const clearWhenRelationTargetMissing = new Set<string>([
  'ai_roast_consents.machine_id',
  'ai_roast_feedback.recommendation_id',
  'ai_roast_feedback.roast_batch_id',
  'ai_roast_profiles.machine_id',
  'ai_roast_recommendations.machine_id',
  'ai_roast_reviews.curve_record_id',
  'ai_roast_reviews.machine_id',
  'ai_roast_reviews.roast_batch_id',
  'roast_profiles.roaster_machine_id',
]);

const appSettingIdKeyPrefixes: {
  collectionName: BackupCollectionName;
  prefix: string;
}[] = [
  { collectionName: 'green_beans', prefix: 'green_bean_sale_defaults:' },
  { collectionName: 'green_beans', prefix: 'green_bean_cost_template:' },
  { collectionName: 'green_beans', prefix: 'green_bean_grade:' },
];

const sanitizeRecordForImport = (record: BackupRecord): BackupRecord => {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !importOmittedFields.has(key)));
};

const normalizeCollectionPayloadForImport = (
  collectionName: BackupCollectionName,
  payload: BackupRecord,
): BackupRecord => {
  if (collectionName !== 'roasting_machines') {
    return payload;
  }

  return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'model_id'));
};

const omitRecordId = (record: BackupRecord): BackupRecord => {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'id'));
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

const isOptionalBackupCollectionUnavailableError = (
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

const isOptionalBackupCollectionListError = (
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

const isDuplicateRecordImportError = (error: unknown): boolean => {
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

const isMissingLegacyRoasterModelError = (error: unknown): boolean => {
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

const listBackupCollectionRecords = async (
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

const registerImportedId = (
  idMaps: BackupIdMaps,
  collectionName: BackupCollectionName,
  oldId: string,
  newId: string,
): void => {
  const collectionMap = idMaps[collectionName] ?? new Map<string, string>();

  collectionMap.set(oldId, newId);
  idMaps[collectionName] = collectionMap;
};

const getMappedId = (
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

const createBackupImportContext = (backup: UserDataBackupFile): BackupImportContext => {
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

const resolveLegacyRoasterModelLabel = (
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

const withLegacyRoasterModelFallback = (
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

const rewriteAppSettingKey = (key: string, idMaps: BackupIdMaps): string => {
  for (const { collectionName, prefix } of appSettingIdKeyPrefixes) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    const oldId = key.slice(prefix.length);
    const newId = idMaps[collectionName]?.get(oldId);

    return newId ? `${prefix}${newId}` : key;
  }

  return key;
};

const rewriteRecordReferences = (
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

const getInsertedRecordId = (rows: BackupRecord[], fallback: string): string => {
  const insertedId = rows[0]?.id;

  return typeof insertedId === 'string' && insertedId.length > 0 ? insertedId : fallback;
};

const collectBackupOwnerIds = (backup: UserDataBackupFile): Set<string> => {
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

const resolveBackupImportMode = (backup: UserDataBackupFile): BackupImportMode => {
  const currentUserId = getCurrentUserId();

  if (!currentUserId) {
    return 'merge-account';
  }

  const ownerIds = collectBackupOwnerIds(backup);

  return ownerIds.size === 1 && ownerIds.has(currentUserId) ? 'same-account' : 'merge-account';
};

const getBackupCollectionRecordIds = (
  backup: UserDataBackupFile,
  collectionName: BackupCollectionName,
): Set<string> => {
  return new Set(
    (backup.collections[collectionName] ?? [])
      .map((record) => record.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
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

const deleteRecordsMissingFromBackup = async (
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

const importBackupRecord = async (
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
      registerImportedId(idMaps, collectionName, oldId, oldId);

      if (strategy === 'merge') {
        return 'skipped';
      }

      const payload = omitRecordId(rewriteRecordReferences(collectionName, record, idMaps));

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

const getBackupFileName = (exportedAt: string): string => {
  const parts = getShanghaiDateParts(exportedAt);
  const timestamp = parts
    ? `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`
    : exportedAt.replace(/\D/g, '').slice(0, 14);

  return `easybake-backup-${timestamp || 'unknown'}.json`;
};

const downloadTextFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
};

const parseBackupFile = (payload: unknown): UserDataBackupFile => {
  if (!isRecord(payload) || payload.schema !== backupSchema || payload.version !== backupVersion) {
    throw new AppError('备份文件格式不正确。', { code: 'DATA' });
  }

  if (!isRecord(payload.collections)) {
    throw new AppError('备份文件缺少业务数据。', { code: 'DATA' });
  }

  const collections: Partial<Record<BackupCollectionName, BackupRecord[]>> = {};

  Object.entries(payload.collections).forEach(([collectionName, records]) => {
    if (!isBackupCollectionName(collectionName) || !Array.isArray(records)) {
      return;
    }

    collections[collectionName] = records.filter(isRecord);
  });

  return {
    collections,
    exportedBy: isRecord(payload.exportedBy) && typeof payload.exportedBy.id === 'string'
      ? {
          email: typeof payload.exportedBy.email === 'string' ? payload.exportedBy.email : undefined,
          id: payload.exportedBy.id,
        }
      : undefined,
    exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : new Date().toISOString(),
    schema: backupSchema,
    summary: isRecord(payload.summary) ? payload.summary : {},
    version: backupVersion,
  };
};

export const userDataBackupService = {
  async createBackup(): Promise<UserDataBackupFile> {
    const client = createClient();
    const collections: Partial<Record<BackupCollectionName, BackupRecord[]>> = {};
    const summary: Partial<Record<BackupCollectionName, number>> = {};

    for (const collectionName of backupCollections) {
      let records: BackupRecord[] = [];

      records = await listBackupCollectionRecords(client, collectionName, {
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
      schema: backupSchema,
      summary,
      version: backupVersion,
    };
  },
  downloadBackup(backup: UserDataBackupFile): void {
    downloadTextFile(getBackupFileName(backup.exportedAt), JSON.stringify(backup, null, 2));
  },
  getImportMode(backup: UserDataBackupFile): BackupImportMode {
    return resolveBackupImportMode(backup);
  },
  async importBackup(
    backup: UserDataBackupFile,
    options: UserDataBackupImportOptions = {},
  ): Promise<UserDataBackupImportResult> {
    const client = createClient();
    const idMaps: BackupIdMaps = {};
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
