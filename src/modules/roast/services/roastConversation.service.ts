import { httpClient } from '@/services/httpClient';

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
  async send(content: string, options: { beanId?: string; mode?: RoastConversationMode; roastBatchId?: string } = {}): Promise<RoastConversation> {
    const response = await httpClient.post<{ conversation: RoastConversation }>('/ai/roast-conversations/messages', { content, ...options });
    return response.data.conversation;
  },
};
