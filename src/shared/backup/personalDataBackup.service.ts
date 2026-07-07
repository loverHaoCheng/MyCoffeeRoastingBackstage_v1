import { indexedDbCacheRepository, type CacheEntry, type CacheNamespace } from '@/shared/cache';
import { AppError } from '@/shared/errors/AppError';

const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_SOURCE = 'coffee-roasting-backstage-web';

const backupNamespaces: CacheNamespace[] = [
  'app-settings',
  'bean',
  'finance',
  'production',
  'roast',
  'sync-queue',
];

export type BackupImportMode = 'merge' | 'replace';

export interface PersonalDataBackupManifest {
  createdAt: string;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  source: typeof BACKUP_SOURCE;
}

export interface PersonalDataBackupPackage {
  entries: CacheEntry[];
  manifest: PersonalDataBackupManifest;
}

const isBackupManifest = (value: unknown): value is PersonalDataBackupManifest => {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const manifest = value as Partial<PersonalDataBackupManifest>;

  return (
    manifest.createdAt != null &&
    typeof manifest.createdAt === 'string' &&
    manifest.schemaVersion === BACKUP_SCHEMA_VERSION &&
    manifest.source === BACKUP_SOURCE
  );
};

const isCacheEntry = (value: unknown): value is CacheEntry => {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const entry = value as Partial<CacheEntry>;
  const namespace = entry.namespace;

  return (
    typeof entry.key === 'string' &&
    namespace != null &&
    backupNamespaces.includes(namespace) &&
    typeof entry.schemaVersion === 'number' &&
    typeof entry.updatedAt === 'string' &&
    'value' in entry &&
    (entry.expiresAt == null || typeof entry.expiresAt === 'string')
  );
};

const parseBackupPackage = (payload: unknown): PersonalDataBackupPackage => {
  if (typeof payload !== 'object' || payload == null) {
    throw new AppError('备份文件格式不正确。', { code: 'DATA' });
  }

  const record = payload as Partial<PersonalDataBackupPackage>;

  if (!isBackupManifest(record.manifest)) {
    throw new AppError('备份文件版本不受支持。', { code: 'DATA' });
  }

  if (!Array.isArray(record.entries) || !record.entries.every(isCacheEntry)) {
    throw new AppError('备份文件数据清单不正确。', { code: 'DATA' });
  }

  return {
    entries: record.entries,
    manifest: record.manifest,
  };
};

export const personalDataBackupService = {
  async exportBackup(): Promise<PersonalDataBackupPackage> {
    const entries = (
      await Promise.all(backupNamespaces.map((namespace) => indexedDbCacheRepository.list(namespace)))
    ).flat();

    return {
      entries,
      manifest: {
        createdAt: new Date().toISOString(),
        schemaVersion: BACKUP_SCHEMA_VERSION,
        source: BACKUP_SOURCE,
      },
    };
  },
  async exportBackupJson(): Promise<string> {
    return JSON.stringify(await this.exportBackup(), null, 2);
  },
  async importBackup(payload: unknown, mode: BackupImportMode = 'merge'): Promise<{ imported: number }> {
    const backupPackage = parseBackupPackage(payload);

    if (mode === 'replace') {
      await Promise.all(backupNamespaces.map((namespace) => indexedDbCacheRepository.clearNamespace(namespace)));
    }

    await Promise.all(
      backupPackage.entries.map((entry) =>
        indexedDbCacheRepository.set(entry.namespace, entry.key, entry.value, {
          expiresAt: entry.expiresAt,
          schemaVersion: entry.schemaVersion,
        }),
      ),
    );

    return { imported: backupPackage.entries.length };
  },
  parseBackupJson(jsonText: string): PersonalDataBackupPackage {
    try {
      return parseBackupPackage(JSON.parse(jsonText) as unknown);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('备份文件不是有效的 JSON。', { code: 'DATA', cause: error });
    }
  },
};
