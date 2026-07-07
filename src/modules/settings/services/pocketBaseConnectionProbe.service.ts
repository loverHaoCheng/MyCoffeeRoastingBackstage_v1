import {
  isPocketBaseProjectConnectionConfigured,
  type PocketBaseDataSource,
  type PocketBaseProjectConnection,
} from '@/modules/settings/types';
import { resolvePocketBaseBaseUrl } from '@/services/pocketBaseConfig';
import { AppError } from '@/shared/errors/AppError';

const isConfiguredConnection = (connection: PocketBaseProjectConnection): boolean => {
  return isPocketBaseProjectConnectionConfigured(connection);
};

export const pocketBaseConnectionProbeService = {
  async verify(
    _dataSource: PocketBaseDataSource,
    connection: PocketBaseProjectConnection,
  ): Promise<void> {
    if (import.meta.env.MODE === 'test') {
      return;
    }

    if (!isConfiguredConnection(connection)) {
      throw new AppError('PocketBase 连接配置缺失。', {
        code: 'CONFIG',
      });
    }

    const response = await fetch(new URL('/api/health', connection.projectUrl || resolvePocketBaseBaseUrl()).toString(), {
      method: 'GET',
    });

    if (!response.ok) {
      throw new AppError('PocketBase 服务不可达。', {
        code: 'NETWORK',
        status: response.status,
      });
    }
  },
};

export const supabaseConnectionProbeService = pocketBaseConnectionProbeService;
