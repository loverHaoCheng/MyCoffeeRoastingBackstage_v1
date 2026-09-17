import ArrowUpOutlined from '@ant-design/icons/ArrowUpOutlined';
import HistoryOutlined from '@ant-design/icons/HistoryOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Drawer from 'antd/es/drawer';
import Input from 'antd/es/input';
import Segmented from 'antd/es/segmented';
import Spin from 'antd/es/spin';
import Tooltip from 'antd/es/tooltip';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type PointerEvent } from 'react';
import { useBeans } from '@/modules/bean/hooks/useBeans';
import { useRoastAiUsage, useRoastAssistantHistory } from '@/modules/roast/hooks';
import { useRoastBatches } from '@/modules/roast/hooks/useRoastBatches';
import { Select } from '@/shared/components/ui/select';
import { defaultRoastPlanFormValues } from '@/modules/roast/constants';
import { RoastAssistantMessage } from '@/modules/roast/components/RoastAssistantMessage';
import { RoastPlanManualCreator } from '@/modules/roast/components/RoastPlanManualCreator';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { cn } from '@/shared/utils/cn';
import { roastConversationService, type RoastConversationMode } from '../services/roastConversation.service';
import type { RoastPlanJsonInput } from '../types';
import type { RoastBatchRecord } from '../types';
import { getComposerPlaceholder, getEmptyStateHint, getSuggestions } from './RoastAssistantPage/suggestionUtils';
import { getRoastAssistantPath, getUsageFeature } from './RoastAssistantPage/modeUtils';
import { useAutoScroll } from './RoastAssistantPage/useAutoScroll';
import { useComposerFocusEffect } from './RoastAssistantPage/useComposerFocusEffect';
import { useConversationSend } from './RoastAssistantPage/useConversationSend';
import { useHeaderActions } from './RoastAssistantPage/useHeaderActions';
import { useHistoryByBean } from './RoastAssistantPage/useHistoryByBean';
import { useRouteSync } from './RoastAssistantPage/useRouteSync';
import styles from './RoastAssistantPage.module.css';

const { TextArea } = Input;
const conversationHistoryQueryKey = ['roast-conversation-history'] as const;

export function RoastAssistantPage() {
  const { message: toast } = App.useApp();
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [draft, setDraft] = useState<RoastPlanJsonInput | null>(null);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const { data: beans = [] } = useBeans();
  const { data: batches = [] } = useRoastBatches();

  const [displayedBeanId, setDisplayedBeanId] = useState<string | undefined>(undefined);
  const [isNewConversation, setIsNewConversation] = useState(false);

  const {
    beanId,
    isNewConversationNavigationRef,
    mode,
    roastBatchId,
    routeBeanId,
    routeRoastBatchId,
    setBeanId,
    setMode,
    setRoastBatchId,
  } = useRouteSync(
    batches.find((batch) => batch.id === routeRoastBatchId) as RoastBatchRecord | undefined,
    setDisplayedBeanId,
    setIsNewConversation,
  );

  const { messagesRef, shouldFollowLatestRef } = useAutoScroll(0, false, false, '');
  const usageFeature = getUsageFeature(mode);
  const {
    content,
    pendingUserMessage,
    send: sendMessage,
    sendMutation,
    setContent,
    streamingAnswer,
  } = useConversationSend(usageFeature, shouldFollowLatestRef, displayedBeanId, setDisplayedBeanId, setIsNewConversation);
  const selectedBatch = batches.find((batch) => batch.id === roastBatchId);
  const isBeanPlanMode = mode === 'bean_plan_recommendation';
  const isGeneralMode = mode === 'general';
  const activeBeanId = isGeneralMode ? undefined : selectedBatch?.greenBeanId ?? beanId;
  const usageQuery = useRoastAiUsage(usageFeature);
  const queryKey = useMemo(
    () => ['roast-conversation', isNewConversation ? 'new' : displayedBeanId ? `bean-${displayedBeanId}` : 'general'],
    [displayedBeanId, isNewConversation],
  );
  const conversationQuery = useQuery({
    enabled: !isNewConversation,
    queryFn: () => roastConversationService.get({ beanId: displayedBeanId }),
    queryKey,
  });
  const conversationsQuery = useQuery({ queryFn: () => roastConversationService.list(), queryKey: conversationHistoryQueryKey });
  const { generalConversation, history, isDiscoveringAnalysisHistory } = useRoastAssistantHistory({
    batches,
    conversations: conversationsQuery.data,
    enabled: isContextOpen || isNewConversation,
    isConversationHistoryResolved: conversationsQuery.isSuccess || conversationsQuery.isError,
  });
  const { historyByBean, historyBeanIds } = useHistoryByBean(history, batches, beans);
  const selectableBeans = isNewConversation
    ? beans.filter((bean) => !historyBeanIds.has(String(bean.id)))
    : activeBeanId
      ? beans.filter((bean) => String(bean.id) === activeBeanId)
      : beans;
  const selectableBatches = isNewConversation
    ? batches.filter((batch) => !historyBeanIds.has(batch.greenBeanId))
    : activeBeanId
      ? batches.filter((batch) => batch.greenBeanId === activeBeanId)
      : batches;
  const isLoadingMessages = conversationQuery.isLoading;
  const isFirstTimeLoading = conversationQuery.isLoading && !conversationQuery.data;
  const messages = conversationQuery.data?.messages ?? [];

  useComposerFocusEffect(isComposerFocused);

  const send = () => {
    if (!content.trim() || sendMutation.isPending) return;
    sendMessage(content.trim(), mode, activeBeanId, roastBatchId);
    setContent('');
  };

  const handleComposerTouchSend = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    send();
  };

  const selectMode = (nextMode: string) => {
    setMode(nextMode as typeof mode);
    if (nextMode === 'general') {
      setBeanId(undefined);
      setRoastBatchId(undefined);
      return;
    }
    if (nextMode === 'bean_plan_recommendation' && selectedBatch) {
      setBeanId(selectedBatch.greenBeanId);
      setRoastBatchId(undefined);
    }
  };

  const selectBean = (value: string | undefined) => {
    setBeanId(value);
    setRoastBatchId(undefined);
  };

  const selectRoastBatch = (value: string | undefined) => {
    setRoastBatchId(value);
    if (!value) setBeanId(undefined);
  };

  const startNewConversation = useCallback(() => {
    isNewConversationNavigationRef.current = true;
    window.location.hash = getRoastAssistantPath({ mode: 'batch_analysis' });
    setBeanId(undefined);
    setRoastBatchId(undefined);
    setDisplayedBeanId(undefined);
    setContent('');
    setMode('batch_analysis');
    setIsNewConversation(true);
  }, [isNewConversationNavigationRef, setBeanId, setMode, setRoastBatchId, setDisplayedBeanId, setContent, setIsNewConversation]);

  const openConversationHistory = useCallback(() => {
    setIsContextOpen(true);
  }, []);

  useHeaderActions(startNewConversation, openConversationHistory);
  const isGeneralConversationSelected = !displayedBeanId;
  const visibleMessages = [
    ...messages,
    ...(pendingUserMessage ? [pendingUserMessage] : []),
    ...(streamingAnswer ? [{ content: streamingAnswer, id: 'streaming-assistant-message', role: 'assistant' as const }] : []),
  ];
  const suggestions = getSuggestions(mode, roastBatchId, activeBeanId);
  const emptyStateHint = getEmptyStateHint(mode, roastBatchId, activeBeanId);
  const composerPlaceholder = getComposerPlaceholder(mode, roastBatchId, activeBeanId);

  return (
    <main className={styles.page}>
      <h1 className="sr-only">AI 分析</h1>
      <section className={styles.chat} aria-label="AI 烘焙助手">
        <div className={styles.contextActions}>
          <Tooltip title="新建对话">
            <Button aria-label="新建对话" className={styles.contextButton} icon={<PlusOutlined />} onClick={startNewConversation} type="text" />
          </Tooltip>
          <Tooltip title="历史对话">
            <Button aria-label="历史对话" className={styles.contextButton} icon={<HistoryOutlined />} onClick={openConversationHistory} type="text" />
          </Tooltip>
        </div>
        <div
          className={styles.messages}
          aria-busy={isLoadingMessages || sendMutation.isPending}
          data-prevent-swipe-navigation="true"
          ref={messagesRef}
        >
          {!isFirstTimeLoading && visibleMessages.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>AI 烘焙助手</p>
              <p className={styles.emptyHint}>{emptyStateHint}</p>
              <div className={styles.suggestions}>
                {suggestions.map((prompt) => (
                  <Button className={styles.suggestion} key={prompt} onClick={() => { setContent(prompt); }} type="text">
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {visibleMessages.map((item) => <RoastAssistantMessage key={item.id} message={item} onCreatePlan={(planDraft) => { setDraft(planDraft); }} />)}
          {sendMutation.isPending ? <div className={styles.pending}><Spin size="small" /> 正在生成分析...</div> : null}
        </div>
        <div className={styles.workspaceBar}>
          {!isGeneralMode ? (
            <>
              <Segmented
                aria-label="选择对话模式"
                block
                className={styles.workspaceMode}
                disabled={sendMutation.isPending}
                onChange={(value) => { selectMode(value as RoastConversationMode); }}
                options={[
                  { label: <><span className={styles.modeLabelFull}>烘焙计划分析</span><span className={styles.modeLabelShort}>复盘</span></>, value: 'batch_analysis' },
                  { label: <><span className={styles.modeLabelFull}>生豆烘焙计划推荐</span><span className={styles.modeLabelShort}>计划</span></>, value: 'bean_plan_recommendation' },
                ]}
                value={mode}
              />
              {isBeanPlanMode ? (
                <Select allowClear aria-label="规划生豆" className={styles.workspaceSelect} disabled={sendMutation.isPending || (isNewConversation && isDiscoveringAnalysisHistory)} onChange={selectBean} options={selectableBeans.map((bean) => ({ label: bean.name, value: String(bean.id) }))} placeholder={isNewConversation && isDiscoveringAnalysisHistory ? '正在读取已有对话...' : '选择生豆'} value={activeBeanId} />
              ) : (
                <Select allowClear aria-label="关联烘焙历史" className={styles.workspaceSelect} disabled={sendMutation.isPending || (isNewConversation && isDiscoveringAnalysisHistory)} onChange={selectRoastBatch} options={selectableBatches.map((batch) => ({ label: `${batch.greenBeanName} · ${batch.roastDate}`, value: batch.id }))} placeholder={isNewConversation && isDiscoveringAnalysisHistory ? '正在读取已有对话...' : '选择烘焙历史'} value={roastBatchId} />
              )}
            </>
          ) : null}
          <span aria-label={usageQuery.data ? `本月剩余 ${String(usageQuery.data.remainingUses)} 次` : '剩余次数读取中'} className={styles.usageBadge}>
            {usageQuery.isLoading ? '...' : `${String(usageQuery.data?.remainingUses ?? '—')} 次`}
          </span>
        </div>
        <form className={styles.composer} data-skip-mobile-keyboard-recenter="true" onSubmit={(event) => { event.preventDefault(); send(); }}>
          <TextArea aria-label="AI 对话输入框" autoSize={{ maxRows: 5, minRows: 2 }} disabled={sendMutation.isPending} maxLength={2000} onBlur={() => { setIsComposerFocused(false); }} onChange={(event) => { setContent(event.target.value); }} onFocus={() => { setIsComposerFocused(true); }} placeholder={composerPlaceholder} value={content} />
          <Button aria-label="发送问题" disabled={sendMutation.isPending || !content.trim()} htmlType="submit" icon={<ArrowUpOutlined />} loading={sendMutation.isPending} onPointerDown={handleComposerTouchSend} shape="circle" type="primary" />
        </form>
      </section>
      <Drawer destroyOnHidden onClose={() => { setIsContextOpen(false); }} open={isContextOpen} placement="right" title="历史对话" width={360}>
        <section className={styles.historySection}>
          <button className={cn(styles.historyItem, isGeneralConversationSelected && styles.historyItemSelected)} onClick={() => { window.location.hash = getRoastAssistantPath({ mode: 'general' }); setIsContextOpen(false); setIsNewConversation(false); }} type="button">
            <span>常识性提问</span>
            {generalConversation ? <span className={styles.historyItemMeta}>已保存</span> : null}
          </button>
          {historyByBean.map((group) => {
            const isSelected = displayedBeanId === group.beanId;
            const representativeBatchId = group.conversations.find((conversation) => conversation.roastBatchId)?.roastBatchId;

            return <button className={cn(styles.historyItem, isSelected && styles.historyItemSelected)} key={group.beanId} onClick={() => { window.location.hash = representativeBatchId ? getRoastAssistantPath({ roastBatchId: representativeBatchId }) : getRoastAssistantPath({ beanId: group.beanId, mode: 'bean_plan_recommendation' }); setIsContextOpen(false); setIsNewConversation(false); }} type="button">{group.beanName}</button>;
          })}
          {isDiscoveringAnalysisHistory ? <p className={styles.historyLoading}>正在查找已保存的 AI 分析...</p> : null}
        </section>
      </Drawer>
      <AppDrawer height="86dvh" onClose={() => { setDraft(null); }} open={draft != null} placement="bottom" title="确认烘焙计划">
        {draft ? <RoastPlanManualCreator initialValues={draft} onCancel={() => { setDraft(null); }} onCreate={async (values) => { await roastPlanService.createPlan(values); setDraft(null); void toast.success('烘焙计划已创建。'); }} /> : null}
      </AppDrawer>
    </main>
  );
}
