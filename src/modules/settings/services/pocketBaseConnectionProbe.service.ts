import {
  isPocketBaseProjectConnectionConfigured,
  type PocketBaseDataSource,
  type PocketBaseProjectConnection,
} from '@/modules/settings/types';
import { isSupabaseProjectUrl, resolvePocketBaseBaseUrl } from '@/services/pocketBaseConfig';
import { SupabaseDataClient } from '@/services/supabaseDataClient';
import { AppError } from '@/shared/errors/AppError';

const isConfiguredConnection = (connection: PocketBaseProjectConnection): boolean => {
  return isPocketBaseProjectConnectionConfigured(connection);
};

export const pocketBaseConnectionProbeService = {
  async verify(
    dataSource: PocketBaseDataSource,
    connection: PocketBaseProjectConnection,
  ): Promise<void> {
    if (import.meta.env.MODE === 'test') {
      return;
    }

    if (!isConfiguredConnection(connection)) {
      throw new AppError('PocketBase 服务器连接配置缺失。', {
        code: 'CONFIG',
      });
    }

    if (dataSource === 'roastedBean' && isSupabaseProjectUrl(connection.projectUrl)) {
      await new SupabaseDataClient(connection).verify();
      return;
    }

    const response = await fetch(new URL('/api/health', connection.projectUrl || resolvePocketBaseBaseUrl()).toString(), {
      method: 'GET',
    });

    if (!response.ok) {
      throw new AppError('PocketBase 服务器不可达。', {
        code: 'NETWORK',
        status: response.status,
      });
    }
  },
};

export const supabaseConnectionProbeService = pocketBaseConnectionProbeService;
