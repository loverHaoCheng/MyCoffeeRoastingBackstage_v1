import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import App from 'antd/es/app';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { roastAiUsageQueryKeys } from '@/modules/roast/hooks';
import {
  roastConversationService,
  type RoastConversation,
  type RoastConversationMessage,
  type RoastConversationMode,
} from '../../services/roastConversation.service';
import type { RoastAiFeature } from '../../types';

const conversationHistoryQueryKey = ['roast-conversation-history'] as const;

export const useConversationSend = (
  usageFeature: RoastAiFeature,
  shouldFollowLatestRef: React.MutableRefObject<boolean>,
) => {
  const { message: toast } = App.useApp();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState<RoastConversationMessage | null>(null);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [displayedBeanId, setDisplayedBeanId] = useState<string | undefined>(undefined);
  const [isNewConversation, setIsNewConversation] = useState(false);

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

  const send = useCallback((
    submittedContent: string,
    mode: RoastConversationMode,
    activeBeanId: string | undefined,
    roastBatchId: string | undefined,
  ) => {
    if (!submittedContent.trim() || sendMutation.isPending) return;

    const isGeneralMode = mode === 'general';
    shouldFollowLatestRef.current = true;
    setContent('');
    setStreamingAnswer('');
    setPendingUserMessage({ content: submittedContent, id: 'pending-user-message', role: 'user' });
    void sendMutation.mutateAsync({
      ...(isGeneralMode ? {} : { beanId: activeBeanId, roastBatchId }),
      content: submittedContent,
      mode,
    });
  }, [sendMutation, shouldFollowLatestRef]);

  return {
    content,
    displayedBeanId,
    isNewConversation,
    pendingUserMessage,
    send,
    sendMutation,
    setContent,
    setDisplayedBeanId,
    setIsNewConversation,
    streamingAnswer,
  };
};
