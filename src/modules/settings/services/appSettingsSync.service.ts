import type { SupabaseDataSource } from '@/modules/settings/types';
import { supabaseConnectionSettingsService } from '@/modules/settings/services/supabaseConnectionSettings.service';
import { SupabaseRestClient } from '@/services/supabaseRestClient';

export interface AppSettingRecord {
  id: string;
  key: string;
  updated_at?: null | string;
  value: unknown;
}

interface SyncAppSettingOptions<T> {
  dataSource?: SupabaseDataSource;
  key: string;
  loadLocal: () => T;
  parseRemote: (record: AppSettingRecord) => T;
  saveLocal: (value: T) => T;
}

const APP_SETTINGS_TABLE = 'app_settings';

const createClient = (dataSource: SupabaseDataSource = 'greenBean'): null | SupabaseRestClient => {
  if (import.meta.env.MODE === 'test') {
    return null;
  }

  const connection = supabaseConnectionSettingsService.resolveProjectConnection(dataSource);

  if (!connection.projectUrl.trim() || !connection.publishableKey.trim()) {
    return null;
  }

  return new SupabaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });
};

export const appSettingsSyncService = {
  async loadRecord(
    key: string,
    dataSource: SupabaseDataSource = 'greenBean',
  ): Promise<AppSettingRecord | null> {
    const client = createClient(dataSource);

    if (!client) {
      return null;
    }

    const rows = await client.list<AppSettingRecord>(APP_SETTINGS_TABLE, {
      limit: 1,
      match: { key },
      orderBy: { ascending: false, column: 'updated_at' },
    });

    return rows[0] ?? null;
  },
  async saveRecord(
    key: string,
    value: unknown,
    dataSource: SupabaseDataSource = 'greenBean',
  ): Promise<void> {
    const client = createClient(dataSource);

    if (!client) {
      return;
    }

    const currentRecord = await this.loadRecord(key, dataSource);
    const payload = {
      key,
      value,
    };

    if (!currentRecord) {
      await client.insert(APP_SETTINGS_TABLE, payload);
      return;
    }

    await client.update(APP_SETTINGS_TABLE, payload, {
      match: { id: currentRecord.id },
      select: '*',
    });
  },
  async syncValue<T>({
    dataSource = 'greenBean',
    key,
    loadLocal,
    parseRemote,
    saveLocal,
  }: SyncAppSettingOptions<T>): Promise<T> {
    const localValue = loadLocal();
    const remoteRecord = await this.loadRecord(key, dataSource);

    if (!remoteRecord) {
      await this.saveRecord(key, localValue, dataSource);
      return saveLocal(localValue);
    }

    return saveLocal(parseRemote(remoteRecord));
  },
};
