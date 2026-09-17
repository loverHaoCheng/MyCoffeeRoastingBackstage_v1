import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import App from 'antd/es/app';
import { useBeans } from '@/modules/bean/hooks/useBeans';
import {
  roastAiUsageQueryKeys,
  useRoastAiUsage,
  useRoastAssistantHistory,
  useRoastBatches,
} from '@/modules/roast/hooks';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import {
  roastConversationService,
  type RoastConversation,
  type RoastConversationMessage,
  type RoastConversationMode,
} from '../../services/roastConversation.service';
import type { RoastPlanJsonInput } from '../../types';
import { getComposerPlaceholder, getRoastAssistantPath, resolveRouteMode } from './utils';

const conversationHistoryQueryKey = ['roast-conversation-history'] as const;

export function useRoastAssistantPage() {
  const { message: toast } = App.useApp();
  const [searchParams] = useSearchParams();
  const routeRoastBatchId = searchParams.get('roastBatchId')?.trim() ?? undefined;
  const routeBeanId = searchParams.get('beanId')?.trim() ?? undefined;
  const routeMode = searchParams.get('mode')?.trim() ?? null;
  const resolvedRouteMode = resolveRouteMode(routeMode, routeRoastBatchId, routeBeanId);
  const queryClient = useQueryClient();

  const [content, setContent] = useState('');
  const [mode, setMode] = useState<RoastConversationMode>(resolvedRouteMode);
  const [beanId, setBeanId] = useState<string | undefined>(routeBeanId);
  const [roastBatchId, setRoastBatchId] = useState<string | undefined>(routeRoastBatchId);
  const [displayedBeanId, setDisplayedBeanId] = useState<string | undefined>(routeBeanId);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isNewConversation, setIsNewConversation] = useState(false);
  const [draft, setDraft] = useState<RoastPlanJsonInput | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<RoastConversationMessage | null>(
    null,
  );
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
    () => [
      'roast-conversation',
      isNewConversation ? 'new' : displayedBeanId ? `bean-${displayedBeanId}` : 'general',
    ],
    [displayedBeanId, isNewConversation],
  );

  const conversationQuery = useQuery({
    enabled: !isNewConversation,
    queryKey,
    queryFn: () => roastConversationService.get({ beanId: displayedBeanId ?? null }),
  });

  const conversationsQuery = useQuery({
    queryKey: conversationHistoryQueryKey,
    queryFn: () => roastConversationService.list(),
  });

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
      const beanName =
        beans.find((candidate) => String(candidate.id) === beanId)?.name ??
        batch?.greenBeanName ??
        '未关联生豆';
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
    mutationFn: (submission: {
      beanId?: string;
      content: string;
      mode: RoastConversationMode;
      roastBatchId?: string;
    }) =>
      roastConversationService.send(submission.content, {
        ...submission,
        onDelta: setStreamingAnswer,
      }),
    onSuccess: (conversation) => {
      const nextDisplayedBeanId = conversation.greenBeanId;
      const nextQueryKey = [
        'roast-conversation',
        nextDisplayedBeanId ? `bean-${nextDisplayedBeanId}` : 'general',
      ];

      queryClient.setQueryData(nextQueryKey, conversation);
      queryClient.setQueryData<RoastConversation[]>(
        conversationHistoryQueryKey,
        (current = []) => [conversation, ...current.filter((item) => item.id !== conversation.id)],
      );
      setPendingUserMessage(null);
      setStreamingAnswer('');
      setIsNewConversation(false);
      setDisplayedBeanId(nextDisplayedBeanId ?? undefined);
      void queryClient.invalidateQueries({ queryKey: roastAiUsageQueryKeys.feature(usageFeature) });
    },
    onError: (error: unknown, submission) => {
      setContent(submission.content);
      setPendingUserMessage(null);
      setStreamingAnswer('');
      void toast.error(getUserFacingErrorMessage(error, 'AI 对话发送失败，请稍后重试。'));
    },
  });

  // Route sync effect
  useEffect(() => {
    const isNewConversationRoute =
      !routeBeanId && !routeRoastBatchId && routeMode === 'batch_analysis';

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

  // Scroll tracking
  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return undefined;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      const isAtLatest =
        messagesElement.scrollTop + messagesElement.clientHeight >= messagesElement.scrollHeight - 2;
      shouldFollowLatestRef.current = isAtLatest;
    };

    messagesElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      messagesElement.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Auto-scroll to latest
  useEffect(() => {
    if (!shouldFollowLatestRef.current) return undefined;
    const messagesElement = messagesRef.current;
    const animationFrameId = window.requestAnimationFrame(() => {
      if (!messagesElement) return;
      isProgrammaticScrollRef.current = true;
      messagesElement.scrollTo({ behavior: 'auto', top: messagesElement.scrollHeight });
      window.requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [messages.length, pendingUserMessage, sendMutation.isPending, streamingAnswer]);

  // Composer focus tracking
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
    setPendingUserMessage({
      content: submittedContent,
      id: 'pending-user-message',
      role: 'user',
    });
    void sendMutation.mutateAsync({
      ...(isGeneralMode ? {} : { beanId: activeBeanId, roastBatchId }),
      content: submittedContent,
      mode,
    });
  };

  const handleComposerTouchSend = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;

    event.preventDefault();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    send();
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

  const handleCreatePlan = (planDraft: RoastPlanJsonInput) => {
    setDraft(planDraft);
  };

  const visibleMessages: RoastConversationMessage[] = [
    ...messages,
    ...(pendingUserMessage ? [pendingUserMessage] : []),
    ...(streamingAnswer
      ? [{ content: streamingAnswer, id: 'streaming-assistant-message', role: 'assistant' as const }]
      : []),
  ];

  const composerPlaceholder = getComposerPlaceholder(isGeneralMode, roastBatchId, activeBeanId);

  const usageDisplay = usageQuery.isLoading
    ? '...'
    : `${String(usageQuery.data?.remainingUses ?? '—')} 次`;
  const usageLabel = usageQuery.data
    ? `本月剩余 ${String(usageQuery.data.remainingUses)} 次`
    : '剩余次数读取中';

  return {
    activeBeanId,
    composerPlaceholder,
    content,
    conversationState: {
      displayedBeanId,
      generalConversation,
      historyByBean,
      isContextOpen,
      isDiscoveringHistory: isDiscoveringAnalysisHistory,
      isNewConversation,
    },
    draft,
    handleComposerTouchSend,
    handleCreatePlan,
    isFirstTimeLoading,
    isGeneralMode,
    isLoadingMessages,
    messages: visibleMessages,
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
  };
}
