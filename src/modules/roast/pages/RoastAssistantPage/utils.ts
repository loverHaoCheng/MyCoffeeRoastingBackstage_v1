import type { RoastConversationMessage, RoastConversationMode } from '../../services/roastConversation.service';
import { defaultRoastPlanFormValues } from '../../constants';
import type { RoastPlanJsonInput } from '../../types';

export const getRoastAssistantPath = (parameters: Record<string, string | undefined>): string => {
  const query = new URLSearchParams(
    Object.entries(parameters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return query.size > 0 ? `/roast-assistant?${query.toString()}` : '/roast-assistant';
};

export const getPlanDraft = (message: RoastConversationMessage): RoastPlanJsonInput | null => {
  if (!message.planDraft?.name) return null;
  return {
    ...defaultRoastPlanFormValues,
    ...message.planDraft,
    steps: message.planDraft?.steps ?? defaultRoastPlanFormValues.steps,
  } as RoastPlanJsonInput;
};

export const getComposerPlaceholder = (
  isGeneralMode: boolean,
  roastBatchId?: string,
  activeBeanId?: string,
): string => {
  if (isGeneralMode) return '例如:浅烘焙一爆后 RoR 应如何控制？';
  if (roastBatchId) return '例如:请复盘这次曲线,并给出下一炉计划。';
  if (activeBeanId) return '例如:请根据这支豆子生成中浅烘计划。';
  return '例如:浅烘焙一爆后 RoR 应如何控制?';
};

export const resolveRouteMode = (
  routeMode: string | null,
  routeRoastBatchId?: string,
  routeBeanId?: string,
): RoastConversationMode => {
  if (routeRoastBatchId) return 'batch_analysis';
  if (
    routeMode === 'batch_analysis' ||
    routeMode === 'bean_plan_recommendation' ||
    routeMode === 'general'
  ) {
    return routeMode;
  }
  if (routeBeanId) return 'bean_plan_recommendation';
  return 'general';
};
