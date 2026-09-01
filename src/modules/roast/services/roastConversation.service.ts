import { httpClient, resolveHttpClientAbsoluteUrl } from '@/services/httpClient';
import { AppError } from '@/shared/errors/AppError';

import type { RoastPlanJsonInput } from '../types';

export type RoastConversationMode = 'batch_analysis' | 'bean_plan_recommendation' | 'general';

export interface RoastConversationLegacyContent {
  points: string[];
  summary: string;
  title: string;
  type: 'curve_review' | 'overall_review';
}

export interface RoastConversationMessage {
  content: string;
  id: string;
  legacy?: RoastConversationLegacyContent;
  planDraft?: Partial<RoastPlanJsonInput>;
  role: 'assistant' | 'user';
}

export interface RoastConversation {
  greenBeanId?: string;
  id: string;
  messages: RoastConversationMessage[];
  mode?: RoastConversationMode;
  roastBatchId?: string;
  scope: 'bean_plan' | 'general' | 'roast_batch';
  title: string;
}

export const roastConversationService = {
  async get(context: { beanId?: string; roastBatchId?: string } = {}): Promise<RoastConversation | null> {
    const queryParams = new URLSearchParams();
    if (context.beanId) queryParams.set('beanId', context.beanId);
    if (context.roastBatchId) queryParams.set('roastBatchId', context.roastBatchId);
    const query = queryParams.size > 0 ? `?${queryParams.toString()}` : '';
    const response = await httpClient.get<{ conversation: RoastConversation | null }>(`/ai/roast-conversations${query}`);
    return response.data.conversation;
  },
  async list(): Promise<RoastConversation[]> {
    const response = await httpClient.get<{ conversations: RoastConversation[] }>('/ai/roast-conversations?list=true');
    return response.data.conversations;
  },
  async send(content: string, options: { beanId?: string; mode?: RoastConversationMode; roastBatchId?: string; onDelta?: (answer: string) => void } = {}): Promise<RoastConversation> {
    const { onDelta, ...payload } = options;
    if (!onDelta) {
      const response = await httpClient.post<{ conversation: RoastConversation }>('/ai/roast-conversations/messages', { content, ...payload });
      return response.data.conversation;
    }
    const response = await fetch(resolveHttpClientAbsoluteUrl('/ai/roast-conversations/messages'), {
      body: JSON.stringify({ content, ...payload }),
      credentials: 'same-origin',
      headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok || !response.body) throw new AppError('AI 对话发送失败，请稍后重试。', { code: 'HTTP', status: response.status });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let conversation: RoastConversation | undefined;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      for (const event of events) {
        const data = event.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim();
        if (!data) continue;
        const parsed = JSON.parse(data) as { answer?: string; conversation?: RoastConversation; message?: string };
        if (parsed.answer) onDelta(parsed.answer);
        if (parsed.conversation) conversation = parsed.conversation;
        if (parsed.message) throw new AppError(parsed.message, { code: 'BUSINESS' });
      }
    }
    if (!conversation) throw new AppError('AI 对话未返回完整结果。', { code: 'UNKNOWN' });
    return conversation;
  },
};
