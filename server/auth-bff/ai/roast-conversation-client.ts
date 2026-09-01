import { aiRequestTimeoutMs, aiRoastBaseUrl, aiRoastModel, aiRoastProvider, isSupportedAiRoastProvider } from '../config.js';
import { fetchWithTimeout, parseJsonResponse } from '../http.js';
import { extractJsonFromModelText, getModelContentText } from './qiniu-client.js';
import { getSafeUpstreamErrorMessage, logger } from '../logger.js';
import { buildRoastModelRequestBody, getRoastModelRequestHeaders, getRoastModelRequestPath } from './roast-model-request.js';
import { isRecord, toTrimmedString } from '../utils.js';

export interface RoastConversationReply {
  answer: string;
  planDraft?: Record<string, unknown>;
}

export interface RoastConversationReplyOptions {
  onDelta?: (answer: string) => void;
}

const createSystemPrompt = (): string => [
  '你是 EasyBake 的 AI 烘焙助手。使用中文、简洁且专业地回答咖啡烘焙问题。',
  'mode 为 general 时，只回答咖啡与咖啡烘焙的常识性问题。不得引用、生豆、烘焙历史、曲线或计划上下文，不得生成 planDraft。',
  '关联烘焙历史时，优先根据提供的历史、曲线、计划和评价解释原因；缺少数据时明确说明，不得臆造。',
  '你统一承接曲线复盘、整体复盘、下一炉调整和计划建议。输入 mode 为 bean_plan_recommendation 时，无论机器历史是否完整，都必须返回非空 planDraft；缺少机器参数时采用保守起始假设并在 answer 中明确说明。其他模式只有用户明确要求生成或修改烘焙计划时才返回 planDraft。',
  '只输出 JSON：{"answer":"...","planDraft":{...} 或 null}。answer 不使用技术字段名。',
  'mode 为 bean_plan_recommendation 时，answer 必须依次包含“规划依据：”“执行思路：”“预计结果：”三段，说明为何如此规划、关键风险、预计风味与下一炉验证方向。',
  'planDraft 如存在，包含 name、beanId、beanName、roasterMachineId、roasterModel、batchWeightGrams、roastLevel、purpose、steps；steps 至少包含入豆、转黄、一爆开始、下豆四个节点，每项包含 time、event、operation、temperature、airTemperature、firePower、drumSpeed、note。无法确定的机器标识留为空字符串，烘焙节点仍需给出可编辑的保守起始值。',
].join('');

const isBeanPlanReplyComplete = (answer: string, planDraft: unknown): planDraft is Record<string, unknown> => {
  return isRecord(planDraft)
    && Array.isArray(planDraft.steps)
    && planDraft.steps.length >= 4
    && answer.includes('规划依据：')
    && answer.includes('执行思路：')
    && answer.includes('预计结果：');
};

const buildRoastApiUrl = (path: string): string => new URL(path.replace(/^\//, ''), `${aiRoastBaseUrl}/`).toString();

export const requestRoastConversationReply = async (input: Record<string, unknown>, options: RoastConversationReplyOptions = {}): Promise<RoastConversationReply> => {
  const apiKey = (process.env.AI_ROAST_API_KEY ?? '').trim();
  const model = (process.env.AI_ROAST_MODEL ?? '').trim() || aiRoastModel;

  if (!apiKey || !model || !isSupportedAiRoastProvider()) {
    throw new Error('服务器未完成烘焙 AI 配置。');
  }

  const upstream = await fetchWithTimeout(buildRoastApiUrl(getRoastModelRequestPath()), {
    body: JSON.stringify(buildRoastModelRequestBody([
      { content: createSystemPrompt(), role: 'system' },
      { content: JSON.stringify(input), role: 'user' },
    ], model, 2200, 0.2, Boolean(options.onDelta))),
    headers: getRoastModelRequestHeaders(apiKey),
    method: 'POST',
  }, aiRequestTimeoutMs);
  let payload: unknown;
  let streamedText = '';
  const contentType = upstream.headers.get('content-type') ?? '';
  if (options.onDelta && upstream.ok && upstream.body && contentType.includes('text/event-stream')) {
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let raw = '';
    let emittedAnswer = '';
    const emit = (fragment: string) => {
      raw += fragment;
      streamedText = raw;
      const match = /"answer"\s*:\s*"((?:\\.|[^"\\])*)/.exec(raw);
      if (!match) return;
      try {
        const partial = JSON.parse(`"${match[1]}"`) as string;
        if (partial.length > emittedAnswer.length) {
          emittedAnswer = partial;
          options.onDelta?.(partial);
        }
      } catch { /* JSON 字符串尚未闭合，等待下一段。 */ }
    };
    const getDeltaText = (event: unknown): string => {
      if (!isRecord(event)) return '';
      if (Array.isArray(event.content)) return event.content.map((part) => isRecord(part) ? toTrimmedString(part.text) : '').join('');
      if (isRecord(event.delta)) {
        const value = event.delta.text ?? event.delta.content;
        return Array.isArray(value) ? value.map((part) => isRecord(part) ? toTrimmedString(part.text) : '').join('') : toTrimmedString(value);
      }
      if (Array.isArray(event.choices) && isRecord(event.choices[0]) && isRecord(event.choices[0].delta)) return toTrimmedString(event.choices[0].delta.content);
      return '';
    };
    const processLine = (line: string): void => {
      const data = line.startsWith('data:') ? line.slice(5).trim() : '';
      if (!data || data === '[DONE]') return;
      try {
        const event = JSON.parse(data) as unknown;
        const delta = getDeltaText(event);
        if (delta) emit(delta);
      } catch { /* 忽略非 JSON SSE 注释行。 */ }
    };
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value as Uint8Array, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) processLine(line);
    }
    processLine(buffer);
    payload = extractJsonFromModelText(raw);
  } else if (options.onDelta && upstream.ok) {
    payload = await parseJsonResponse(upstream);
    const fallbackText = getModelContentText(payload);
    if (fallbackText) options.onDelta(fallbackText);
  } else {
    payload = await parseJsonResponse(upstream);
  }

  if (!upstream.ok) {
    logger.error('roast_conversation_ai_request_failed', { model, provider: aiRoastProvider, status: upstream.status, upstreamMessage: getSafeUpstreamErrorMessage(payload) });
    throw new Error('AI 烘焙助手暂时无法回答，请稍后重试。');
  }

  let parsed: unknown;
  try {
    parsed = extractJsonFromModelText(streamedText || getModelContentText(payload));
  } catch (error) {
    const plainText = (streamedText || getModelContentText(payload)).trim();
    if (toTrimmedString(input.mode) === 'general' && plainText) {
      parsed = { answer: plainText };
    } else {
      throw error;
    }
  }
  if (!isRecord(parsed) || !toTrimmedString(parsed.answer)) {
    throw new Error('AI 烘焙助手返回内容不符合预期。');
  }

  const answer = toTrimmedString(parsed.answer);
  const isBeanPlanMode = toTrimmedString(input.mode) === 'bean_plan_recommendation';

  if (isBeanPlanMode && !isBeanPlanReplyComplete(answer, parsed.planDraft)) {
    throw new Error('AI 烘焙助手未生成完整的计划说明与计划草稿，请重试。');
  }

  return {
    answer,
    ...(isRecord(parsed.planDraft) ? { planDraft: parsed.planDraft } : {}),
  };
};
