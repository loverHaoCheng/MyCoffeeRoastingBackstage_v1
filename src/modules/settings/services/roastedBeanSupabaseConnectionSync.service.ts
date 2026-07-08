import { appSettingsSyncService } from '@/modules/settings/services/appSettingsSync.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import {
  normalizeRoastedBeanPocketBaseProjectConnection,
  type PocketBaseConnectionSettings,
  type PocketBaseProjectConnection,
} from '@/modules/settings/types';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';

const SUPABASE_ROASTED_BEAN_CONNECTION_KEY = 'supabase_roasted_bean_connection_settings';

interface RoastedBeanSupabaseConnectionRecord {
  publishableKey: string;
  projectUrl: string;
  updatedAt: string | null;
}

const isRoastedBeanSupabaseConnectionRecord = (
  value: unknown,
): value is RoastedBeanSupabaseConnectionRecord => {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.projectUrl === 'string' &&
    typeof record.publishableKey === 'string' &&
    (record.updatedAt == null || typeof record.updatedAt === 'string')
  );
};

const toRecordValue = (connection: PocketBaseProjectConnection): RoastedBeanSupabaseConnectionRecord => {
  const normalized = normalizeRoastedBeanPocketBaseProjectConnection(connection);

  return {
    projectUrl: normalized.projectUrl,
    publishableKey: normalized.publishableKey,
    updatedAt: new Date().toISOString(),
  };
};

const parseRemoteConnection = (value: unknown): PocketBaseProjectConnection => {
  if (!isRoastedBeanSupabaseConnectionRecord(value)) {
    throw new AppError('熟豆连接远端数据格式无效。', {
      code: 'DATA',
    });
  }

  return normalizeRoastedBeanPocketBaseProjectConnection(value);
};

export const hasSyncableRoastedBeanConnection = (connection: PocketBaseProjectConnection): boolean => {
  const normalized = normalizeRoastedBeanPocketBaseProjectConnection(connection);

  return (
    normalized.projectUrl.trim().length > 0 &&
    normalized.publishableKey.trim().length > 0
  );
};

export const roastedBeanSupabaseConnectionSyncService = {
  async loadRemote(): Promise<null | PocketBaseProjectConnection> {
    const record = await appSettingsSyncService.loadRecord(
      SUPABASE_ROASTED_BEAN_CONNECTION_KEY,
      'greenBean',
    );

    if (!record) {
      return null;
    }

    return parseRemoteConnection(record.value);
  },
  async saveRemote(connection: PocketBaseProjectConnection): Promise<void> {
    await appSettingsSyncService.saveRecord(
      SUPABASE_ROASTED_BEAN_CONNECTION_KEY,
      toRecordValue(connection),
      'greenBean',
    );
  },
  async syncFromRemote(): Promise<PocketBaseConnectionSettings> {
    const currentSettings = pocketBaseConnectionSettingsService.load();
    const remoteConnection = await this.loadRemote();

    if (!remoteConnection) {
      return currentSettings;
    }

    return pocketBaseConnectionSettingsService.save({
      ...currentSettings,
      roastedBean: remoteConnection,
      updatedAt: new Date().toISOString(),
    });
  },
  async syncFromRemoteSafely(): Promise<PocketBaseConnectionSettings> {
    try {
      return await this.syncFromRemote();
    } catch (error) {
      logger.warn('roasted bean supabase connection remote pull failed', { error });
      return pocketBaseConnectionSettingsService.load();
    }
  },
  async syncLocalChange(
    localConnection = pocketBaseConnectionSettingsService.resolveProjectConnection('roastedBean'),
  ): Promise<PocketBaseProjectConnection> {
    const normalizedConnection = normalizeRoastedBeanPocketBaseProjectConnection(localConnection);

    if (!hasSyncableRoastedBeanConnection(normalizedConnection)) {
      return normalizedConnection;
    }

    await this.saveRemote(normalizedConnection);

    return normalizedConnection;
  },
  async syncLocalChangeSafely(
    localConnection = pocketBaseConnectionSettingsService.resolveProjectConnection('roastedBean'),
  ): Promise<PocketBaseProjectConnection> {
    try {
      return await this.syncLocalChange(localConnection);
    } catch (error) {
      logger.warn('roasted bean supabase connection remote push failed', { error });
      return normalizeRoastedBeanPocketBaseProjectConnection(localConnection);
    }
  },
};
