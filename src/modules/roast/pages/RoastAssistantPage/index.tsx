import { useContext, useEffect } from 'react';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import HistoryOutlined from '@ant-design/icons/HistoryOutlined';
import { HeaderActionRegistrationContext } from '@/shared/components/ViewportFloatingActionButton.context';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { RoastPlanManualCreator } from '../../components/RoastPlanManualCreator';
import { roastPlanService } from '../../services/roastPlan.service';
import { ContextActions } from './ContextActions';
import { ConversationHistoryDrawer } from './ConversationHistoryDrawer';
import { EmptyState } from './EmptyState';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';
import { WorkspaceBar } from './WorkspaceBar';
import { useRoastAssistantPage } from './useRoastAssistantPage';
import { getRoastAssistantPath } from './utils';

import styles from '../RoastAssistantPage.module.css';

export function RoastAssistantPage() {
  const headerActionRegistration = useContext(HeaderActionRegistrationContext);
  const {
    activeBeanId,
    composerPlaceholder,
    content,
    conversationState,
    draft,
    handleComposerTouchSend,
    handleCreatePlan,
    isFirstTimeLoading,
    isGeneralMode,
    messages,
    messagesRef,
    mode,
    openConversationHistory,
    roastBatchId,
    selectBean,
    selectMode,
    selectRoastBatch,
    selectableBatches,
    selectableBeans,
    sendMutation,
    setContent,
    setDraft,
    setIsComposerFocused,
    setIsContextOpen,
    startNewConversation,
    toast,
    usageDisplay,
    usageLabel,
  } = useRoastAssistantPage();

  useEffect(() => {
    if (!headerActionRegistration) {
      return;
    }

    return headerActionRegistration.register([
      { ariaLabel: '新建对话', icon: <PlusOutlined />, onClick: startNewConversation },
      { ariaLabel: '历史对话', icon: <HistoryOutlined />, onClick: openConversationHistory },
    ]);
  }, [headerActionRegistration, openConversationHistory, startNewConversation]);

  return (
    <main className={styles.page}>
      <h1 className="sr-only">AI 分析</h1>
      <section className={styles.chat} aria-label="AI 烘焙助手">
        <ContextActions onOpenHistory={openConversationHistory} onStartNew={startNewConversation} />
        <MessageList
          emptyState={
            <EmptyState
              activeBeanId={activeBeanId}
              isGeneralMode={isGeneralMode}
              onSuggestionClick={setContent}
              roastBatchId={roastBatchId}
            />
          }
          isFirstTimeLoading={isFirstTimeLoading}
          isPending={sendMutation.isPending}
          messagesRef={messagesRef as React.RefObject<HTMLDivElement>}
          onCreatePlan={(planDraft) => {
            handleCreatePlan(planDraft);
          }}
          visibleMessages={messages}
        />
        <WorkspaceBar
          activeBeanId={activeBeanId}
          disabled={sendMutation.isPending}
          isDiscoveringHistory={conversationState.isDiscoveringHistory}
          isGeneralMode={isGeneralMode}
          isNewConversation={conversationState.isNewConversation}
          mode={mode}
          onSelectBean={selectBean}
          onSelectMode={selectMode}
          onSelectRoastBatch={selectRoastBatch}
          roastBatchId={roastBatchId}
          selectableBatches={selectableBatches}
          selectableBeans={selectableBeans}
          usageDisplay={usageDisplay}
          usageLabel={usageLabel}
        />
        <MessageComposer
          content={content}
          disabled={sendMutation.isPending}
          onBlur={() => {
            setIsComposerFocused(false);
          }}
          onChange={setContent}
          onFocus={() => {
            setIsComposerFocused(true);
          }}
          onSend={() => {
            if (!content.trim() || sendMutation.isPending) return;
            const submittedContent = content.trim();
            setContent('');
            void sendMutation.mutateAsync({
              ...(isGeneralMode ? {} : { beanId: activeBeanId, roastBatchId }),
              content: submittedContent,
              mode,
            });
          }}
          onTouchSend={handleComposerTouchSend}
          placeholder={composerPlaceholder}
        />
      </section>
      <ConversationHistoryDrawer
        displayedBeanId={conversationState.displayedBeanId}
        generalConversation={conversationState.generalConversation}
        historyByBean={conversationState.historyByBean}
        isDiscoveringHistory={conversationState.isDiscoveringHistory}
        onClose={() => {
          setIsContextOpen(false);
        }}
        onNavigate={(path) => {
          window.location.hash = path;
          setIsContextOpen(false);
        }}
        open={conversationState.isContextOpen}
      />
      <AppDrawer
        height="86dvh"
        onClose={() => {
          setDraft(null);
        }}
        open={draft != null}
        placement="bottom"
        title="确认烘焙计划"
      >
        {draft ? (
          <RoastPlanManualCreator
            initialValues={draft}
            onCancel={() => {
              setDraft(null);
            }}
            onCreate={async (values) => {
              await roastPlanService.createPlan(values);
              setDraft(null);
              void toast.success('烘焙计划已创建。');
            }}
          />
        ) : null}
      </AppDrawer>
    </main>
  );
}
