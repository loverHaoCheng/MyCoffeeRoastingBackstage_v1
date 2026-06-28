import type { ApiResponse } from '@/services/api.types';

import { dashboardOverview } from '../constants/dashboard.mock';
import type { DashboardOverview } from '../types';

export const dashboardService = {
  async getOverview(): Promise<ApiResponse<DashboardOverview>> {
    return Promise.resolve({
      code: 0,
      message: 'ok',
      data: dashboardOverview,
    });
  },
};

