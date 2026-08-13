import { useMemo } from 'react';

import type { RoastConversation } from '../services/roastConversation.service';
import type { RoastBatchRecord } from '../types/roastBatch';

interface UseRoastAssistantHistoryOptions {
  batches: RoastBatchRecord[];
  conversations: RoastConversation[] | undefined;
  enabled: boolean;
  isConversationHistoryResolved: boolean;
}

export function useRoastAssistantHistory({
  batches,
  conversations,
  enabled,
  isConversationHistoryResolved,
}: UseRoastAssistantHistoryOptions) {
  const history = useMemo(() => {
    const beanConversations = new Map<string, RoastConversation>();
    conversations?.filter((conversation) => conversation.scope === 'bean_plan' && conversation.greenBeanId)
      .forEach((conversation) => { beanConversations.set(conversation.greenBeanId ?? '', conversation); });

    const relatedBatchIds = new Set((conversations ?? [])
      .filter((conversation) => conversation.scope === 'roast_batch' && conversation.roastBatchId)
      .map((conversation) => conversation.roastBatchId ?? ''));

    batches.filter((batch) => relatedBatchIds.has(batch.id)).forEach((batch) => {
      const existingConversation = beanConversations.get(batch.greenBeanId);

      if (existingConversation) {
        if (!existingConversation.roastBatchId) {
          beanConversations.set(batch.greenBeanId, {
            ...existingConversation,
            roastBatchId: batch.id,
          });
        }
        return;
      }

      beanConversations.set(batch.greenBeanId, {
        greenBeanId: batch.greenBeanId,
        id: `legacy-bean-${batch.greenBeanId}`,
        messages: [],
        roastBatchId: batch.id,
        scope: 'bean_plan',
        title: '生豆烘焙计划',
      });
    });

    return [...beanConversations.values()];
  }, [batches, conversations]);
  const generalConversation = conversations?.find((conversation) => conversation.scope === 'general');

  return {
    generalConversation,
    history,
    isDiscoveringAnalysisHistory: enabled && !isConversationHistoryResolved,
  };
}
