// @vitest-environment node

import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listPocketBaseRecords: vi.fn(),
  parseLimitedJsonBody: vi.fn(),
  proxyPocketBaseRequest: vi.fn(),
  refreshAuthenticatedSession: vi.fn(),
  requestRoastConversationReply: vi.fn(),
  ensureRoastAiUsageAvailable: vi.fn(),
  readRoastAiUsageContext: vi.fn(),
  releaseRoastAiUsageReservation: vi.fn(),
  reserveRoastAiUsage: vi.fn(),
  sendApiError: vi.fn(),
  sendApiSuccess: vi.fn(),
}));

vi.mock('../auth-common.js', () => ({
  refreshAuthenticatedSession: mocks.refreshAuthenticatedSession,
}));

vi.mock('../http.js', () => ({
  parseLimitedJsonBody: mocks.parseLimitedJsonBody,
  sendApiError: mocks.sendApiError,
  sendApiSuccess: mocks.sendApiSuccess,
}));

vi.mock('../pocketbase-client.js', () => ({
  normalizeErrorPayload: () => ({}),
  proxyPocketBaseRequest: mocks.proxyPocketBaseRequest,
}));

vi.mock('../record-utils.js', () => ({
  escapeFilterValue: (value: string) => JSON.stringify(value),
  getFirstListItem: (payload: unknown) => (payload as { items: Record<string, unknown>[] }).items[0] ?? null,
  isOptionalCollectionMissing: (statusCode: number) => statusCode === 404,
  listPocketBaseRecords: mocks.listPocketBaseRecords,
}));

vi.mock('../utils.js', () => ({
  isRecord: (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value != null && !Array.isArray(value),
  toTrimmedString: (value: unknown) => typeof value === 'string' ? value.trim() : '',
}));

vi.mock('./roast-conversation-client.js', () => ({
  requestRoastConversationReply: mocks.requestRoastConversationReply,
}));

vi.mock('./roast-usage-handler.js', () => ({
  ensureRoastAiUsageAvailable: mocks.ensureRoastAiUsageAvailable,
  readRoastAiUsageContext: mocks.readRoastAiUsageContext,
  releaseRoastAiUsageReservation: mocks.releaseRoastAiUsageReservation,
  reserveRoastAiUsage: mocks.reserveRoastAiUsage,
}));

import { handleGetRoastConversation, handleSendRoastConversationMessage } from './roast-conversation-handler.js';
import { PocketBaseGatewayError } from '../types.js';

const createPocketBaseResponse = (payload: Record<string, unknown>) => ({
  payload,
  response: new Response(JSON.stringify(payload), { status: 200 }),
});

type ProxyRequestCall = [path: string, options?: { body?: string }];
type ApiSuccessCall = [response: unknown, payload: { conversation: Record<string, unknown> }];

describe('bean plan conversations', () => {
  it('creates a persistent conversation scoped to the selected bean', async () => {
    mocks.refreshAuthenticatedSession.mockResolvedValue({ record: { id: 'owner-1' }, token: 'session-token' });
    mocks.parseLimitedJsonBody.mockResolvedValue({
      beanId: 'bean-1',
      content: '这个豆子适合中浅烘还是深烘？',
      mode: 'bean_plan_recommendation',
    });
    mocks.listPocketBaseRecords.mockResolvedValue({ items: [] });
    mocks.readRoastAiUsageContext.mockResolvedValue({ feature: 'roast_plan_recommendation' });
    mocks.requestRoastConversationReply.mockResolvedValue({
      answer: '规划依据：以生豆风味为基准。\n\n执行思路：采用保守热量。\n\n预计结果：获得清晰甜感。',
      planDraft: { beanId: 'wrong-bean', beanName: '错误生豆', name: '中浅烘计划', steps: [{ event: '入豆' }] },
    });
    mocks.proxyPocketBaseRequest.mockImplementation((path: string, options?: RequestInit) => {
      if (path.endsWith('/green_beans/records/bean-1')) {
        return Promise.resolve(createPocketBaseResponse({ id: 'bean-1', name: '测试生豆' }));
      }

      const body = JSON.parse(typeof options?.body === 'string' ? options.body : '{}') as Record<string, unknown>;

      if (path.endsWith('/ai_roast_conversations/records')) {
        return Promise.resolve(createPocketBaseResponse({ id: 'conversation-1', ...body }));
      }

      return Promise.resolve(createPocketBaseResponse({ id: 'message-1', ...body }));
    });

    await handleSendRoastConversationMessage({} as IncomingMessage, {} as ServerResponse);

    const proxyCalls = mocks.proxyPocketBaseRequest.mock.calls as unknown as ProxyRequestCall[];
    const conversationCreateCall = proxyCalls.find(([path]) =>
      path.endsWith('/ai_roast_conversations/records'),
    );
    const conversationBody = JSON.parse(conversationCreateCall?.[1]?.body ?? '{}') as Record<string, unknown>;
    const successCalls = mocks.sendApiSuccess.mock.calls as unknown as ApiSuccessCall[];
    const successPayload = successCalls[0]?.[1];

    expect(conversationBody).toMatchObject({
      conversation_scope: 'bean_plan',
      green_bean_id: 'bean-1',
      owner: 'owner-1',
      title: '生豆烘焙计划',
    });
    expect(mocks.requestRoastConversationReply).toHaveBeenCalledWith(expect.objectContaining({
      bean: { id: 'bean-1', name: '测试生豆' },
      mode: 'bean_plan_recommendation',
      question: '这个豆子适合中浅烘还是深烘？',
    }));
    expect(mocks.ensureRoastAiUsageAvailable).toHaveBeenCalledWith({ feature: 'roast_plan_recommendation' });
    expect(mocks.reserveRoastAiUsage).toHaveBeenCalledWith({ feature: 'roast_plan_recommendation' });
    expect(successPayload.conversation).toMatchObject({ greenBeanId: 'bean-1', scope: 'bean_plan' });
    const conversationMessages = successPayload.conversation.messages as {
      planDraft?: Record<string, unknown>;
      role?: string;
    }[];
    const assistantMessage = conversationMessages.find((message) => message.role === 'assistant');

    expect(assistantMessage?.planDraft).toMatchObject({
      beanId: 'bean-1',
      beanName: '测试生豆',
      name: '中浅烘计划',
    });
  });

  it('keeps legacy analysis history available when the conversation collection is not imported', async () => {
    mocks.refreshAuthenticatedSession.mockResolvedValue({ record: { id: 'owner-1' }, token: 'session-token' });
    mocks.listPocketBaseRecords.mockImplementation((_token: string, collection: string) => {
      if (collection === 'ai_roast_conversations') {
        throw new PocketBaseGatewayError(404, { message: 'The requested resource wasn\'t found.' });
      }

      if (collection === 'ai_roast_reviews') {
        return Promise.resolve({ items: [{ roast_batch_id: 'batch-1' }] });
      }

      return Promise.resolve({ items: [] });
    });

    await handleGetRoastConversation(
      {} as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1/api/ai/roast-conversations?list=true'),
    );

    const successCalls = mocks.sendApiSuccess.mock.calls as unknown as ApiSuccessCall[];
    const payload = successCalls.at(-1)?.[1];

    expect(payload?.conversation).toBeUndefined();
    expect((payload as unknown as { conversations: Record<string, unknown>[] }).conversations).toEqual([
      expect.objectContaining({ id: 'legacy-batch-1', roastBatchId: 'batch-1', scope: 'roast_batch' }),
    ]);
  });
});
