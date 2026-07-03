import type { SupabaseDataSource, SupabaseProjectConnection } from '@/modules/settings/types';
import { SupabaseRestClient } from '@/services/supabaseRestClient';
import { AppError } from '@/shared/errors/AppError';

const probeTableBySource: Record<SupabaseDataSource, string> = {
  greenBean: 'app_settings',
  roastedBean: 'coffee_beans',
};

const isConfiguredConnection = (connection: SupabaseProjectConnection): boolean => {
  return connection.projectUrl.trim().length > 0 && connection.publishableKey.trim().length > 0;
};

export const supabaseConnectionProbeService = {
  async verify(
    dataSource: SupabaseDataSource,
    connection: SupabaseProjectConnection,
  ): Promise<void> {
    if (import.meta.env.MODE === 'test') {
      return;
    }

    if (!isConfiguredConnection(connection)) {
      throw new AppError('Supabase 连接配置缺失。', {
        code: 'CONFIG',
      });
    }

    const client = new SupabaseRestClient({
      projectUrl: connection.projectUrl,
      publishableKey: connection.publishableKey,
      timeoutMs: 8000,
    });

    await client.list(probeTableBySource[dataSource], {
      limit: 1,
      select: 'id',
    });
  },
};
