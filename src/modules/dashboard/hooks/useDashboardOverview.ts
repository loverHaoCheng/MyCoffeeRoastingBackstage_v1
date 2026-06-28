import { useQuery } from '@tanstack/react-query';

import { dashboardService } from '@/modules/dashboard/services/dashboard.service';

export const dashboardQueryKeys = {
  overview: ['dashboard', 'overview'] as const,
};

export function useDashboardOverview() {
  return useQuery({
    queryKey: dashboardQueryKeys.overview,
    queryFn: async () => {
      const response = await dashboardService.getOverview();
      return response.data;
    },
  });
}

