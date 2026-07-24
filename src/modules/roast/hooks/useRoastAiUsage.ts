import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  isRoastAiClientEnabled,
} from '../services/roastTrainingUpload.service';
import { roastAiUsageService } from '../services/roastAiUsage.service';
import type { RoastAiFeature } from '../types/roastAiUsage';

export const roastAiUsageQueryKeys = {
  all: ['roast-ai-usage'] as const,
  feature: (feature: RoastAiFeature) => [...roastAiUsageQueryKeys.all, feature] as const,
};

export function useRoastAiUsage(feature: RoastAiFeature) {
  return useQuery({
    enabled: isRoastAiClientEnabled(),
    queryFn: () => roastAiUsageService.getUsage(feature),
    queryKey: roastAiUsageQueryKeys.feature(feature),
    retry: false,
  });
}

export function useInvalidateRoastAiUsage() {
  const queryClient = useQueryClient();

  return (feature: RoastAiFeature) => {
    void queryClient.invalidateQueries({
      queryKey: roastAiUsageQueryKeys.feature(feature),
    });
  };
}
