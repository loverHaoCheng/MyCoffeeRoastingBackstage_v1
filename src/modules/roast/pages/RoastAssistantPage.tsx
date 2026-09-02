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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBeans } from '@/modules/bean/hooks/useBeans';
import { roastAiUsageQueryKeys, useRoastAiUsage, useRoastAssistantHistory, useRoastBatches } from '@/modules/roast/hooks';
import { Select } from '@/components/ui/select';

import { defaultRoastPlanFormValues } from '@/modules/roast/constants';
import { RoastAssistantMessage } from '@/modules/roast/components/RoastAssistantMessage';
import { RoastPlanManualCreator } from '@/modules/roast/components/RoastPlanManualCreator';
import { roastPlanService } from '@/modules/roast/services/roastPlan.service';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { HeaderActionRegistrationContext } from '@/shared/components/ViewportFloatingActionButton.context';
import { cn } from '@/shared/utils/cn';

import {
  roastConversationService,
  type RoastConversation,
  type RoastConversationMessage,
  type RoastConversationMode,
} from '../services/roastConversation.service';
import type { RoastPlanJsonInput } from '../types';

import styles from './RoastAssistantPage.module.css';

const { TextArea } = Input;
const conversationHistoryQueryKey = ['roast-conversation-history'] as const;

const getRoastAssistantPath = (parameters: Record<string, string | undefined>): string => {
  const query = new URLSearchParams(
    Object.entries(parameters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return query.size > 0 ? `/roast-assistant?${query.toString()}` : '/roast-assistant';
};

const getPlanDraft = (message: RoastConversationMessage): RoastPlanJsonInput => ({
  ...defaultRoastPlanFormValues,
  ...message.planDraft,
  steps: message.planDraft?.steps ?? defaultRoastPlanFormValues.steps,
});

export function RoastAssistantPage() {
  const { message: toast } = App.useApp();
  const headerActionRegistration = useContext(HeaderActionRegistrationContext);
  const [searchParams] = useSearchParams();
  const routeRoastBatchId = searchParams.get('roastBatchId')?.trim() ?? undefined;
  const routeBeanId = searchParams.get('beanId')?.trim() ?? undefined;
  const routeMode = searchParams.get('mode')?.trim();
  const resolvedRouteMode: RoastConversationMode = routeRoastBatchId
    ? 'batch_analysis'
    : routeMode === 'batch_analysis' || routeMode === 'bean_plan_recommendation' || routeMode === 'general'
      ? routeMode
      : routeBeanId
        ? 'bean_plan_recommendation'
        : 'general';
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<RoastConversationMode>(resolvedRouteMode);
  const [beanId, setBeanId] = useState<string | undefined>(routeBeanId);
  const [roastBatchId, setRoastBatchId] = useState<string | undefined>(routeRoastBatchId);
  const [displayedBeanId, setDisplayedBeanId] = useState<string | undefined>(routeBeanId);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isNewConversation, setIsNewConversation] = useState(false);
  const [draft, setDraft] = useState<RoastPlanJsonInput | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<RoastConversationMessage | null>(null);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const isNewConversationNavigationRef = useRef(false);
  const shouldFollowLatestRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const { data: beans = [] } = useBeans();
  const { data: batches = [] } = useRoastBatches();
  const selectedBatch = batches.find((batch) => batch.id === roastBatchId);
  const routeBatch = batches.find((batch) => batch.id === routeRoastBatchId);
  const isBeanPlanMode = mode === 'bean_plan_recommendation';
  const isGeneralMode = mode === 'general';
  const usageFeature = isGeneralMode
    ? 'roast_general_question'
    : isBeanPlanMode
      ? 'roast_plan_recommendation'
      : 'roast_analysis';
  const activeBeanId = isGeneralMode ? undefined : selectedBatch?.greenBeanId ?? beanId;
  const usageQuery = useRoastAiUsage(usageFeature);
  const queryKey = useMemo(
    () => ['roast-conversation', isNewConversation ? 'new' : displayedBeanId ? `bean-${displayedBeanId}` : 'general'],
    [displayedBeanId, isNewConversation],
  );
  const conversationQuery = useQuery({
    enabled: !isNewConversation,
    queryKey,
    queryFn: () => roastConversationService.get({ beanId: displayedBeanId }),
  });
  const conversationsQuery = useQuery({ queryKey: conversationHistoryQueryKey, queryFn: () => roastConversationService.list() });
  const { generalConversation, history, isDiscoveringAnalysisHistory } = useRoastAssistantHistory({
    batches,
    conversations: conversationsQuery.data,
    enabled: isContextOpen || isNewConversation,
    isConversationHistoryResolved: conversationsQuery.isSuccess || conversationsQuery.isError,
  });
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
  const sendMutation = useMutation({
    mutationFn: (submission: { beanId?: string; content: string; mode: RoastConversationMode; roastBatchId?: string }) =>
      roastConversationService.send(submission.content, { ...submission, onDelta: setStreamingAnswer }),
    onSuccess: (conversation) => {
      const nextDisplayedBeanId = conversation.greenBeanId;
      const nextQueryKey = ['roast-conversation', nextDisplayedBeanId ? `bean-${nextDisplayedBeanId}` : 'general'];

      queryClient.setQueryData(nextQueryKey, conversation);
      queryClient.setQueryData<RoastConversation[]>(conversationHistoryQueryKey, (current = []) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ]);
      setPendingUserMessage(null);
      setStreamingAnswer('');
      setIsNewConversation(false);
      setDisplayedBeanId(nextDisplayedBeanId);
      void queryClient.invalidateQueries({ queryKey: roastAiUsageQueryKeys.feature(usageFeature) });
    },
    onError: (error: unknown, submission) => {
      setContent(submission.content);
      setPendingUserMessage(null);
      setStreamingAnswer('');
      void toast.error(getUserFacingErrorMessage(error, 'AI 对话发送失败，请稍后重试。'));
    },
  });

  useEffect(() => {
    const isNewConversationRoute = !routeBeanId
      && !routeRoastBatchId
      && routeMode === 'batch_analysis';

    if (isNewConversationNavigationRef.current && isNewConversationRoute) {
      isNewConversationNavigationRef.current = false;
      return;
    }

    isNewConversationNavigationRef.current = false;

    const nextDisplayedBeanId = routeBeanId ?? routeBatch?.greenBeanId;

    setBeanId(routeBeanId);
    setRoastBatchId(routeRoastBatchId);
    setDisplayedBeanId(nextDisplayedBeanId);
    shouldFollowLatestRef.current = true;
    setMode(resolvedRouteMode);
    setIsNewConversation(false);
  }, [resolvedRouteMode, routeBatch?.greenBeanId, routeBeanId, routeMode, routeRoastBatchId]);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return undefined;
    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      const isAtLatest = messagesElement.scrollTop + messagesElement.clientHeight >= messagesElement.scrollHeight - 2;
      shouldFollowLatestRef.current = isAtLatest;
    };
    messagesElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => { messagesElement.removeEventListener('scroll', handleScroll); };
  }, []);

  useEffect(() => {
    if (!shouldFollowLatestRef.current) return undefined;
    const messagesElement = messagesRef.current;
    const animationFrameId = window.requestAnimationFrame(() => {
      if (!messagesElement) return;
      isProgrammaticScrollRef.current = true;
      messagesElement.scrollTo({ behavior: 'auto', top: messagesElement.scrollHeight });
      window.requestAnimationFrame(() => { isProgrammaticScrollRef.current = false; });

    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [messages.length, pendingUserMessage, sendMutation.isPending, streamingAnswer]);

  useEffect(() => {
    if (isComposerFocused) {
      document.documentElement.setAttribute('data-composer-focused', 'true');
    } else {
      document.documentElement.removeAttribute('data-composer-focused');
    }

    return () => {
      document.documentElement.removeAttribute('data-composer-focused');
    };
  }, [isComposerFocused]);

  const send = () => {
    if (!content.trim() || sendMutation.isPending) return;
    const submittedContent = content.trim();

    shouldFollowLatestRef.current = true;
    setContent('');
    setStreamingAnswer('');
    setPendingUserMessage({ content: submittedContent, id: 'pending-user-message', role: 'user' });
    void sendMutation.mutateAsync({
      ...(isGeneralMode ? {} : { beanId: activeBeanId, roastBatchId }),
      content: submittedContent,
      mode,
    });
  };

  const selectMode = (nextMode: RoastConversationMode) => {
    setMode(nextMode);

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
  }, []);
  const openConversationHistory = useCallback(() => {
    setIsContextOpen(true);
  }, []);
  useEffect(() => {
    if (!headerActionRegistration) {
      return;
    }

    return headerActionRegistration.register([
      { ariaLabel: '新建对话', icon: <PlusOutlined />, onClick: startNewConversation },
      { ariaLabel: '历史对话', icon: <HistoryOutlined />, onClick: openConversationHistory },
    ]);
  }, [headerActionRegistration, openConversationHistory, startNewConversation]);
  const isGeneralConversationSelected = !displayedBeanId;
  const visibleMessages = [
    ...messages,
    ...(pendingUserMessage ? [pendingUserMessage] : []),
    ...(streamingAnswer ? [{ content: streamingAnswer, id: 'streaming-assistant-message', role: 'assistant' as const }] : []),
  ];

  return (
    <main className={styles.page}>
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
              <p className={styles.emptyHint}>
                {isGeneralMode
                  ? '提问咖啡和咖啡烘焙的常识性问题。'
                  : roastBatchId
                  ? '基于当前烘焙记录，分析曲线并生成改进计划。'
                  : activeBeanId
                    ? '基于当前生豆，讨论烘焙目标并生成计划。'
                  : '提问烘焙技巧、分析历史曲线、生成优化计划。'}
              </p>
              <div className={styles.suggestions}>
                {(isGeneralMode
                  ? ['一爆通常意味着什么？', '浅烘焙如何避免尖酸？', '如何判断豆子是否养好？']
                  : roastBatchId
                  ? ['这炉最需要调整什么？', '生成下一炉烘焙计划', '结合杯测继续分析']
                  : activeBeanId
                    ? ['建议做中浅烘还是中烘？', '生成一份手冲浅烘计划', '如何突出花香与果酸？']
                  : ['如何判断 RoR 是否稳定？', '浅烘焙如何控制发展时间？', '帮我规划一炉手冲浅烘']).map((prompt) => (
                  <Button className={styles.suggestion} key={prompt} onClick={() => { setContent(prompt); }} type="text">
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {visibleMessages.map((item) => <RoastAssistantMessage key={item.id} message={item} onCreatePlan={(message) => { setDraft(getPlanDraft(message)); }} />)}
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
          <TextArea autoSize={{ maxRows: 5, minRows: 2 }} disabled={sendMutation.isPending} maxLength={2000} onBlur={() => { setIsComposerFocused(false); }} onChange={(event) => { setContent(event.target.value); }} onFocus={() => { setIsComposerFocused(true); }} placeholder={isGeneralMode ? '例如:浅烘焙一爆后 RoR 应如何控制？' : roastBatchId ? '例如:请复盘这次曲线,并给出下一炉计划。' : activeBeanId ? '例如:请根据这支豆子生成中浅烘计划。' : '例如:浅烘焙一爆后 RoR 应如何控制?'} value={content} />
          <Button aria-label="发送问题" disabled={sendMutation.isPending || !content.trim()} htmlType="submit" icon={<ArrowUpOutlined />} loading={sendMutation.isPending} shape="circle" type="primary" />
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
