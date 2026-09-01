import type { IncomingMessage, ServerResponse } from 'node:http';

import { refreshAuthenticatedSession } from '../auth-common.js';
import {
  AI_FEATURE_ROAST_ANALYSIS,
  AI_FEATURE_ROAST_GENERAL_QUESTION,
  AI_FEATURE_ROAST_PLAN_RECOMMENDATION,
} from '../config.js';
import { parseLimitedJsonBody, sendApiError, sendApiSuccess } from '../http.js';
import { normalizeErrorPayload, proxyPocketBaseRequest } from '../pocketbase-client.js';
import { escapeFilterValue, getFirstListItem, isOptionalCollectionMissing, listPocketBaseRecords } from '../record-utils.js';
import { PocketBaseGatewayError } from '../types.js';
import { isRecord, toTrimmedString } from '../utils.js';
import { requestRoastConversationReply } from './roast-conversation-client.js';
import {
  ensureRoastAiUsageAvailable,
  readRoastAiUsageContext,
  releaseRoastAiUsageReservation,
  reserveRoastAiUsage,
  type RoastAiUsageContext,
} from './roast-usage-handler.js';

const CONVERSATIONS = 'ai_roast_conversations';
const MESSAGES = 'ai_roast_messages';
const AI_ROAST_REVIEWS = 'ai_roast_reviews';
const AI_ROAST_RECOMMENDATIONS = 'ai_roast_recommendations';
const ROAST_BATCHES = 'roast_batches';
const GREEN_BEANS = 'green_beans';
const MAX_MESSAGE_LENGTH = 2_000;
type RoastConversationMode = 'batch_analysis' | 'bean_plan_recommendation' | 'general';

interface LegacyMessageContent {
  points: string[];
  summary: string;
  title: string;
  type: 'curve_review' | 'overall_review';
}

interface ConversationMessageRecord {
  content: string;
  created?: string;
  id: string;
  legacy?: LegacyMessageContent;
  planDraft?: Record<string, unknown>;
  role: 'assistant' | 'user';
}

type ConversationScope = 'bean_plan' | 'general' | 'roast_batch';

interface ConversationLookup {
  greenBeanId: string;
  roastBatchId: string;
  scope: ConversationScope;
}

const createRecord = async (token: string, collection: string, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const upstream = await proxyPocketBaseRequest(`/api/collections/${collection}/records`, { body: JSON.stringify(body), headers: { Accept: 'application/json', Authorization: token, 'Content-Type': 'application/json' }, method: 'POST' });
  if (!upstream.response.ok || !isRecord(upstream.payload)) throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  return upstream.payload;
};

const listOptionalConversationRecords = async (
  token: string,
  collection: string,
  options: Parameters<typeof listPocketBaseRecords>[2],
): Promise<unknown> => {
  try {
    return await listPocketBaseRecords(token, collection, options);
  } catch (error) {
    if (error instanceof PocketBaseGatewayError && isOptionalCollectionMissing(error.status, error.payload)) {
      return { items: [] };
    }

    throw error;
  }
};

const readConversation = async (token: string, ownerId: string, lookup: ConversationLookup): Promise<Record<string, unknown> | null> => {
  const filter = lookup.scope === 'roast_batch'
    ? `owner = ${escapeFilterValue(ownerId)} && conversation_scope = ${escapeFilterValue(lookup.scope)} && roast_batch_id = ${escapeFilterValue(lookup.roastBatchId)}`
    : lookup.scope === 'bean_plan'
      ? `owner = ${escapeFilterValue(ownerId)} && conversation_scope = ${escapeFilterValue(lookup.scope)} && green_bean_id = ${escapeFilterValue(lookup.greenBeanId)}`
      : `owner = ${escapeFilterValue(ownerId)} && conversation_scope = ${escapeFilterValue(lookup.scope)}`;
  return getFirstListItem(await listOptionalConversationRecords(token, CONVERSATIONS, { fields: '*', filter, perPage: 1 }));
};

const listMessages = async (token: string, conversationId: string): Promise<Record<string, unknown>[]> => {
  const payload = await listOptionalConversationRecords(token, MESSAGES, { fields: '*', filter: `conversation_id = ${escapeFilterValue(conversationId)}`, perPage: 40, sort: '-created' });
  const items = isRecord(payload) && Array.isArray(payload.items) ? payload.items.filter(isRecord) : [];
  return items.reverse();
};

const getListItems = (payload: unknown): Record<string, unknown>[] => {
  return isRecord(payload) && Array.isArray(payload.items) ? payload.items.filter(isRecord) : [];
};

const sortConversationMessages = (messages: ConversationMessageRecord[]): ConversationMessageRecord[] => {
  return messages.sort((left, right) => left.created?.localeCompare(right.created ?? '') ?? 0);
};

const toConversationMessageRecord = (record: Record<string, unknown>): ConversationMessageRecord => ({
  content: toTrimmedString(record.content),
  created: toTrimmedString(record.created),
  id: toTrimmedString(record.id),
  planDraft: isRecord(record.plan_draft) ? record.plan_draft : undefined,
  role: toTrimmedString(record.role) as 'assistant' | 'user',
});

const getBeanBatchIds = async (token: string, ownerId: string, greenBeanId: string): Promise<string[]> => {
  if (!greenBeanId) return [];

  const payload = await listPocketBaseRecords(token, ROAST_BATCHES, {
    fields: 'id',
    filter: `owner = ${escapeFilterValue(ownerId)} && green_bean_id = ${escapeFilterValue(greenBeanId)}`,
    perPage: 200,
  });

  return getListItems(payload).map((record) => toTrimmedString(record.id)).filter(Boolean);
};

const toLegacyCurveReviewMessage = (record: Record<string, unknown>): ConversationMessageRecord | null => {
  const analysis = isRecord(record.analysis_result) ? record.analysis_result : null;

  if (!analysis) {
    return null;
  }

  const primaryAdjustment = isRecord(analysis.primaryAdjustment) ? analysis.primaryAdjustment : null;
  const nextAdjustments = Array.isArray(analysis.nextRoastAdjustments)
    ? analysis.nextRoastAdjustments.map(toTrimmedString).filter(Boolean)
    : [];
  const sections = [
    'AI 曲线复盘',
    toTrimmedString(analysis.summary),
    primaryAdjustment ? `主要调整：${toTrimmedString(primaryAdjustment.action) || toTrimmedString(primaryAdjustment.rationale)}` : '',
    nextAdjustments.length > 0 ? `下一炉建议：\n${nextAdjustments.map((item) => `- ${item}`).join('\n')}` : '',
  ].filter(Boolean);

  if (sections.length === 1) {
    return null;
  }

  return {
    content: sections.join('\n\n'),
    created: toTrimmedString(record.created),
    id: `legacy-curve-review-${toTrimmedString(record.id)}`,
    legacy: {
      points: [
        toTrimmedString(primaryAdjustment?.action) || toTrimmedString(primaryAdjustment?.rationale),
        ...nextAdjustments,
      ].filter(Boolean),
      summary: toTrimmedString(analysis.summary),
      title: 'AI 曲线复盘',
      type: 'curve_review',
    },
    role: 'assistant',
  };
};

const toLegacyOverallReviewMessage = (record: Record<string, unknown>): ConversationMessageRecord | null => {
  const context = isRecord(record.request_context) ? record.request_context : null;

  if (!context) {
    return null;
  }

  const adjustments = Array.isArray(context.adjustments)
    ? context.adjustments.filter(isRecord).map((adjustment) => {
      const area = toTrimmedString(adjustment.area);
      const suggestion = toTrimmedString(adjustment.suggestion);

      return [area, suggestion].filter(Boolean).join('：');
    }).filter(Boolean)
    : [];
  const sections = [
    'AI 整体复盘与计划建议',
    toTrimmedString(context.overallReview),
    adjustments.length > 0 ? `调整建议：\n${adjustments.map((item) => `- ${item}`).join('\n')}` : '',
  ].filter(Boolean);

  if (sections.length === 1) {
    return null;
  }

  return {
    content: sections.join('\n\n'),
    created: toTrimmedString(record.created),
    id: `legacy-overall-review-${toTrimmedString(record.id)}`,
    legacy: {
      points: adjustments,
      summary: toTrimmedString(context.overallReview),
      title: 'AI 整体复盘与计划建议',
      type: 'overall_review',
    },
    planDraft: isRecord(record.plan_draft) ? record.plan_draft : undefined,
    role: 'assistant',
  };
};

const getLegacyAnalysisMessages = async (
  token: string,
  ownerId: string,
  context: { greenBeanId?: string; roastBatchId?: string },
): Promise<ConversationMessageRecord[]> => {
  const batchIds = context.greenBeanId
    ? await getBeanBatchIds(token, ownerId, context.greenBeanId)
    : context.roastBatchId ? [context.roastBatchId] : [];
  if (batchIds.length === 0) {
    return [];
  }

  const [reviewPayload, recommendationPayload] = await Promise.all([
    listPocketBaseRecords(token, AI_ROAST_REVIEWS, {
      fields: 'id,analysis_result,created,roast_batch_id',
      filter: `owner = ${escapeFilterValue(ownerId)}`,
      perPage: 200,
      sort: 'created',
    }),
    listPocketBaseRecords(token, AI_ROAST_RECOMMENDATIONS, {
      fields: 'id,plan_draft,request_context,created',
      filter: `owner = ${escapeFilterValue(ownerId)}`,
      perPage: 200,
      sort: 'created',
    }),
  ]);
  const curveReviews = getListItems(reviewPayload)
    .filter((record) => batchIds.includes(toTrimmedString(record.roast_batch_id)))
    .map(toLegacyCurveReviewMessage)
    .filter((message): message is ConversationMessageRecord => message != null);
  const overallReviews = getListItems(recommendationPayload)
    .filter((record) => {
      const context = isRecord(record.request_context) ? record.request_context : null;
      return batchIds.includes(toTrimmedString(context?.roastBatchId));
    })
    .map(toLegacyOverallReviewMessage)
    .filter((message): message is ConversationMessageRecord => message != null);

  return sortConversationMessages([...curveReviews, ...overallReviews]);
};

const getBatchConversationMessages = async (
  token: string,
  ownerId: string,
  greenBeanId: string,
): Promise<ConversationMessageRecord[]> => {
  const batchIds = await getBeanBatchIds(token, ownerId, greenBeanId);
  if (batchIds.length === 0) return [];

  const payload = await listOptionalConversationRecords(token, CONVERSATIONS, {
    fields: '*',
    filter: `owner = ${escapeFilterValue(ownerId)} && conversation_scope = ${escapeFilterValue('roast_batch')}`,
    perPage: 200,
  });
  const batchConversations = getListItems(payload)
    .filter((record) => batchIds.includes(toTrimmedString(record.roast_batch_id)));
  const messages = await Promise.all(batchConversations.map(async (conversation) => {
    return listMessages(token, toTrimmedString(conversation.id));
  }));

  return sortConversationMessages(messages.flatMap((items) => items.map(toConversationMessageRecord)));
};

const toConversationMessages = (messages: (ConversationMessageRecord | Record<string, unknown>)[]) => {
  return messages.map((message) => ({
    content: toTrimmedString(message.content),
    id: toTrimmedString(message.id),
    legacy: isRecord(message.legacy)
      ? {
          points: Array.isArray(message.legacy.points) ? message.legacy.points.map(toTrimmedString).filter(Boolean) : [],
          summary: toTrimmedString(message.legacy.summary),
          title: toTrimmedString(message.legacy.title),
          type: toTrimmedString(message.legacy.type),
        }
      : undefined,
    planDraft: isRecord(message.planDraft)
      ? message.planDraft
      : isRecord(message) && isRecord(message.plan_draft)
        ? message.plan_draft
        : undefined,
    role: toTrimmedString(message.role),
  }));
};

const getBatchContext = async (token: string, roastBatchId: string): Promise<Record<string, unknown> | null> => {
  if (!roastBatchId) return null;
  const upstream = await proxyPocketBaseRequest(`/api/collections/${ROAST_BATCHES}/records/${encodeURIComponent(roastBatchId)}`, { headers: { Accept: 'application/json', Authorization: token }, method: 'GET' });
  if (upstream.response.status === 404) return null;
  if (!upstream.response.ok || !isRecord(upstream.payload)) throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  return upstream.payload;
};

const getBeanContext = async (token: string, beanId: string): Promise<Record<string, unknown> | null> => {
  if (!beanId) return null;
  const upstream = await proxyPocketBaseRequest(`/api/collections/${GREEN_BEANS}/records/${encodeURIComponent(beanId)}`, { headers: { Accept: 'application/json', Authorization: token }, method: 'GET' });
  if (upstream.response.status === 404) return null;
  if (!upstream.response.ok || !isRecord(upstream.payload)) throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  return upstream.payload;
};

const toConversation = (record: Record<string, unknown>, messages: (ConversationMessageRecord | Record<string, unknown>)[]) => ({
  greenBeanId: toTrimmedString(record.green_bean_id) || undefined,
  id: toTrimmedString(record.id),
  roastBatchId: toTrimmedString(record.roast_batch_id) || undefined,
  scope: toTrimmedString(record.conversation_scope),
  title: toTrimmedString(record.title),
  messages: toConversationMessages(messages),
});

export const handleGetRoastConversation = async (request: IncomingMessage, response: ServerResponse, requestUrl: URL): Promise<void> => {
  const session = await refreshAuthenticatedSession(request, response);
  if (!session) return;
  const roastBatchId = toTrimmedString(requestUrl.searchParams.get('roastBatchId'));
  const beanId = toTrimmedString(requestUrl.searchParams.get('beanId'));
  try {
    if (requestUrl.searchParams.get('list') === 'true') {
      const payload = await listOptionalConversationRecords(session.token, CONVERSATIONS, { fields: '*', filter: `owner = ${escapeFilterValue(session.record.id)}`, perPage: 100, sort: '-updated' });
      const items = getListItems(payload);
      const conversationBatchIds = new Set(items.map((item) => toTrimmedString(item.roast_batch_id)).filter(Boolean));
      const [reviewPayload, recommendationPayload] = await Promise.all([
        listPocketBaseRecords(session.token, AI_ROAST_REVIEWS, { fields: 'roast_batch_id', filter: `owner = ${escapeFilterValue(session.record.id)}`, perPage: 100 }),
        listPocketBaseRecords(session.token, AI_ROAST_RECOMMENDATIONS, { fields: 'request_context', filter: `owner = ${escapeFilterValue(session.record.id)}`, perPage: 200 }),
      ]);
      const legacyBatchIds = new Set([
        ...getListItems(reviewPayload).map((item) => toTrimmedString(item.roast_batch_id)),
        ...getListItems(recommendationPayload).map((item) => {
          const context = isRecord(item.request_context) ? item.request_context : null;
          return toTrimmedString(context?.roastBatchId);
        }),
      ].filter(Boolean));
      const legacyConversations = [...legacyBatchIds]
        .filter((roastBatchId) => !conversationBatchIds.has(roastBatchId))
        .map((roastBatchId) => ({ id: `legacy-${roastBatchId}`, messages: [], roastBatchId, scope: 'roast_batch', title: '烘焙历史分析' }));

      sendApiSuccess(response, { conversations: [...items.map((item) => toConversation(item, [])), ...legacyConversations] });
      return;
    }
    const batch = await getBatchContext(session.token, roastBatchId);
    const greenBeanId = beanId || toTrimmedString(batch?.green_bean_id);
    const lookup: ConversationLookup = greenBeanId
      ? { greenBeanId, roastBatchId: '', scope: 'bean_plan' }
      : { greenBeanId: '', roastBatchId: '', scope: 'general' };
    const conversation = await readConversation(session.token, session.record.id, lookup);
    const [storedMessages, legacyMessages, batchConversationMessages] = await Promise.all([
      conversation ? listMessages(session.token, toTrimmedString(conversation.id)) : Promise.resolve([]),
      getLegacyAnalysisMessages(session.token, session.record.id, { greenBeanId, roastBatchId }),
      greenBeanId ? getBatchConversationMessages(session.token, session.record.id, greenBeanId) : Promise.resolve([]),
    ]);
    const messages = sortConversationMessages([
      ...legacyMessages,
      ...batchConversationMessages,
      ...storedMessages.map(toConversationMessageRecord),
    ]);
    const virtualConversation = greenBeanId && messages.length > 0
      ? { conversation_scope: 'bean_plan', green_bean_id: greenBeanId, id: `legacy-${greenBeanId}`, title: '生豆烘焙计划' }
      : null;

    sendApiSuccess(response, { conversation: conversation ? toConversation(conversation, messages) : virtualConversation ? toConversation(virtualConversation, messages) : null });
  } catch (error) {
    sendApiError(response, error instanceof PocketBaseGatewayError ? error.status : 502, 'AI 对话读取失败。');
  }
};

export const handleSendRoastConversationMessage = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const session = await refreshAuthenticatedSession(request, response);
  if (!session) return;
  const body = await parseLimitedJsonBody(request, { maxBytes: 8 * 1024 });
  const content = isRecord(body) ? toTrimmedString(body.content) : '';
  const roastBatchId = isRecord(body) ? toTrimmedString(body.roastBatchId) : '';
  const beanId = isRecord(body) ? toTrimmedString(body.beanId) : '';
  const requestedMode = isRecord(body) ? toTrimmedString(body.mode) : '';
  const mode: RoastConversationMode = requestedMode === 'bean_plan_recommendation'
    ? 'bean_plan_recommendation'
    : requestedMode === 'general'
      ? 'general'
      : 'batch_analysis';
  if (!content || content.length > MAX_MESSAGE_LENGTH) { sendApiError(response, 400, '请输入不超过 2000 个字符的问题。'); return; }
  let usageContext: RoastAiUsageContext | null = null;
  const requestHeaders = (request as unknown as { headers?: IncomingMessage['headers'] }).headers;
  const isStreaming = typeof requestHeaders?.accept === 'string' && requestHeaders.accept.includes('text/event-stream');
  if (isStreaming && typeof response.writeHead === 'function') {
    response.writeHead(200, { 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no' });
  }
  const sendEvent = (event: string, data: unknown): void => {
    if (isStreaming && typeof response.write === 'function') response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const selectedRoastBatchId = mode === 'general' ? '' : roastBatchId;
    const selectedBeanId = mode === 'general' ? '' : beanId;
    const batch = await getBatchContext(session.token, selectedRoastBatchId);
    if (selectedRoastBatchId && !batch) { sendApiError(response, 404, '未找到关联的烘焙历史。'); return; }
    const greenBeanId = selectedBeanId || toTrimmedString(batch?.green_bean_id);
    const bean = await getBeanContext(session.token, greenBeanId);
    if (greenBeanId && !bean) { sendApiError(response, 404, '未找到关联的生豆。'); return; }
    const lookup: ConversationLookup = greenBeanId
      ? { greenBeanId, roastBatchId: '', scope: 'bean_plan' }
      : { greenBeanId: '', roastBatchId: '', scope: 'general' };
    let conversation = await readConversation(session.token, session.record.id, lookup);
    conversation ??= await createRecord(session.token, CONVERSATIONS, {
      owner: session.record.id,
      conversation_scope: lookup.scope,
      ...(lookup.greenBeanId ? { green_bean_id: lookup.greenBeanId } : {}),
      ...(lookup.roastBatchId ? { roast_batch_id: lookup.roastBatchId } : {}),
      title: lookup.scope === 'bean_plan' ? '生豆烘焙计划' : '常识性提问',
    });
    const conversationId = toTrimmedString(conversation.id);
    const [existingMessages, legacyMessages, batchConversationMessages] = await Promise.all([
      listMessages(session.token, conversationId),
      mode === 'general' ? Promise.resolve([]) : getLegacyAnalysisMessages(session.token, session.record.id, { greenBeanId, roastBatchId: selectedRoastBatchId }),
      mode === 'general' || !greenBeanId ? Promise.resolve([]) : getBatchConversationMessages(session.token, session.record.id, greenBeanId),
    ]);
    await createRecord(session.token, MESSAGES, { owner: session.record.id, conversation_id: conversationId, role: 'user', content });
    const existingConversationMessages = existingMessages.map(toConversationMessageRecord);
    const conversationHistory = [...legacyMessages, ...batchConversationMessages, ...existingConversationMessages]
      .slice(-12)
      .map((message) => ({ content: toTrimmedString(message.content), role: toTrimmedString(message.role) }));
    usageContext = await readRoastAiUsageContext(
      session.record.id,
      mode === 'bean_plan_recommendation'
        ? AI_FEATURE_ROAST_PLAN_RECOMMENDATION
        : mode === 'general'
          ? AI_FEATURE_ROAST_GENERAL_QUESTION
          : AI_FEATURE_ROAST_ANALYSIS,
    );
    ensureRoastAiUsageAvailable(usageContext);
    await reserveRoastAiUsage(usageContext);
    const replyInput = { batch, bean, history: conversationHistory, mode, question: content };
    const reply = isStreaming
      ? await requestRoastConversationReply(replyInput, { onDelta: (answer) => { sendEvent('delta', { answer }); } })
      : await requestRoastConversationReply(replyInput);
    const planDraft = mode !== 'general' && reply.planDraft
      ? {
          ...reply.planDraft,
          ...(greenBeanId ? { beanId: greenBeanId } : {}),
          ...(toTrimmedString(bean?.name) ? { beanName: toTrimmedString(bean?.name) } : {}),
        }
      : undefined;
    const assistantMessage = await createRecord(session.token, MESSAGES, { owner: session.record.id, conversation_id: conversationId, role: 'assistant', content: reply.answer, ...(planDraft ? { plan_draft: planDraft } : {}) });
    const conversationPayload = {
      conversation: toConversation(conversation, sortConversationMessages([
        ...legacyMessages,
        ...batchConversationMessages,
        ...existingConversationMessages,
        { content, id: `pending-user-${conversationId}`, role: 'user' },
        toConversationMessageRecord(assistantMessage),
      ])),
    };
    if (isStreaming) {
      sendEvent('done', conversationPayload);
      response.end();
    } else {
      sendApiSuccess(response, conversationPayload);
    }
  } catch (error) {
    if (usageContext) {
      await releaseRoastAiUsageReservation(
        usageContext,
        error instanceof Error ? error.message : 'AI 对话失败。',
      );
    }
    const message = error instanceof PocketBaseGatewayError ? normalizeErrorPayload(error.payload).message ?? 'AI 对话保存失败。' : error instanceof Error ? error.message : 'AI 对话失败。';
    if (isStreaming) {
      sendEvent('error', { message });
      response.end();
    } else {
      sendApiError(response, error instanceof PocketBaseGatewayError ? error.status : 502, message);
    }
  }
};
