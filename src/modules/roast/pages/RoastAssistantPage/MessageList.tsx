import { Spin } from 'antd';
import type { RoastConversationMessage } from '../../services/roastConversation.service';
import { RoastAssistantMessage } from '../../components/RoastAssistantMessage';
import type { RoastPlanJsonInput } from '../../types';

import styles from '../RoastAssistantPage.module.css';

interface MessageListProps {
  emptyState?: React.ReactNode;
  isFirstTimeLoading: boolean;
  isPending: boolean;
  messagesRef: React.RefObject<HTMLDivElement>;
  onCreatePlan: (planDraft: RoastPlanJsonInput) => void;
  visibleMessages: RoastConversationMessage[];
}

export function MessageList({
  emptyState,
  isFirstTimeLoading,
  isPending,
  messagesRef,
  onCreatePlan,
  visibleMessages,
}: MessageListProps) {
  return (
    <div
      className={styles.messages}
      aria-busy={isPending}
      data-prevent-swipe-navigation="true"
      ref={messagesRef}
    >
      {!isFirstTimeLoading && visibleMessages.length === 0 && emptyState}
      {visibleMessages.map((item) => (
        <RoastAssistantMessage
          key={item.id}
          message={item}
          onCreatePlan={onCreatePlan}
        />
      ))}
      {isPending ? (
        <div className={styles.pending}>
          <Spin size="small" /> 正在生成分析...
        </div>
      ) : null}
    </div>
  );
}
