import { Drawer } from 'antd';
import { cn } from '@/shared/utils/cn';
import type { RoastConversation } from '../../services/roastConversation.service';

import styles from '../RoastAssistantPage.module.css';

interface ConversationHistoryDrawerProps {
  displayedBeanId?: string;
  generalConversation?: RoastConversation;
  historyByBean: Array<{ beanId: string; beanName: string; conversations: RoastConversation[] }>;
  isDiscoveringHistory: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  open: boolean;
}

const getRoastAssistantPath = (parameters: Record<string, string | undefined>): string => {
  const query = new URLSearchParams(
    Object.entries(parameters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return query.size > 0 ? `/roast-assistant?${query.toString()}` : '/roast-assistant';
};

export function ConversationHistoryDrawer({
  displayedBeanId,
  generalConversation,
  historyByBean,
  isDiscoveringHistory,
  onClose,
  onNavigate,
  open,
}: ConversationHistoryDrawerProps) {
  const isGeneralSelected = !displayedBeanId;

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      placement="right"
      title="历史对话"
      width={360}
    >
      <section className={styles.historySection}>
        <button
          className={cn(styles.historyItem, isGeneralSelected && styles.historyItemSelected)}
          onClick={() => {
            onNavigate(getRoastAssistantPath({ mode: 'general' }));
            onClose();
          }}
          type="button"
        >
          <span>常识性提问</span>
          {generalConversation ? <span className={styles.historyItemMeta}>已保存</span> : null}
        </button>
        {historyByBean.map((group) => {
          const isSelected = displayedBeanId === group.beanId;
          const representativeBatchId = group.conversations.find(
            (conversation) => conversation.roastBatchId,
          )?.roastBatchId;

          return (
            <button
              className={cn(styles.historyItem, isSelected && styles.historyItemSelected)}
              key={group.beanId}
              onClick={() => {
                const path = representativeBatchId
                  ? getRoastAssistantPath({ roastBatchId: representativeBatchId })
                  : getRoastAssistantPath({ beanId: group.beanId, mode: 'bean_plan_recommendation' });
                onNavigate(path);
                onClose();
              }}
              type="button"
            >
              {group.beanName}
            </button>
          );
        })}
        {isDiscoveringHistory ? (
          <p className={styles.historyLoading}>正在查找已保存的 AI 分析...</p>
        ) : null}
      </section>
    </Drawer>
  );
}
