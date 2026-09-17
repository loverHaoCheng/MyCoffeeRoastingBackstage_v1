import { useMemo } from 'react';
import type { Bean } from '@/types/domain';
import type { RoastBatchRecord } from '../../types';
import type { RoastConversation } from '../../services/roastConversation.service';

export const useHistoryByBean = (
  history: RoastConversation[],
  batches: RoastBatchRecord[],
  beans: Bean[],
) => {
  const historyByBean = useMemo(() => {
    const groups = new Map<string, { beanName: string; conversations: RoastConversation[] }>();

    history.forEach((conversation) => {
      const batch = batches.find((candidate) => candidate.id === conversation.roastBatchId);
      const beanId = conversation.greenBeanId ?? batch?.greenBeanId;
      const beanName = beans.find((candidate) => String(candidate.id) === beanId)?.name ?? batch?.greenBeanName ?? '未关联生豆';
      const key = beanId ?? 'unassociated';
      const group = groups.get(key) ?? { beanName, conversations: [] };

      group.conversations.push(conversation);
      groups.set(key, group);
    });

    return [...groups.entries()].map(([beanId, group]) => ({ beanId, ...group }));
  }, [batches, beans, history]);

  const historyBeanIds = useMemo(
    () => new Set(historyByBean.map((group) => group.beanId).filter((id) => id !== 'unassociated')),
    [historyByBean],
  );

  return { historyByBean, historyBeanIds };
};
