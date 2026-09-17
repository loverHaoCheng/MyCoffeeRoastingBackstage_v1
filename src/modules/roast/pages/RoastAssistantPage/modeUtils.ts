import type { RoastConversationMode } from '../../services/roastConversation.service';
import type { RoastAiFeature } from '../../types';

export const resolveRouteMode = (
  routeRoastBatchId: string | undefined,
  routeMode: string | undefined | null,
  routeBeanId: string | undefined,
): RoastConversationMode => {
  if (routeRoastBatchId) {
    return 'batch_analysis';
  }

  if (routeMode === 'batch_analysis' || routeMode === 'bean_plan_recommendation' || routeMode === 'general') {
    return routeMode;
  }

  if (routeBeanId) {
    return 'bean_plan_recommendation';
  }

  return 'general';
};

export const getUsageFeature = (mode: RoastConversationMode): RoastAiFeature => {
  if (mode === 'general') {
    return 'roast_general_question';
  }

  if (mode === 'bean_plan_recommendation') {
    return 'roast_plan_recommendation';
  }

  return 'roast_analysis';
};

export const getRoastAssistantPath = (parameters: Record<string, string | undefined>): string => {
  const query = new URLSearchParams(
    Object.entries(parameters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return query.size > 0 ? `/roast-assistant?${query.toString()}` : '/roast-assistant';
};
