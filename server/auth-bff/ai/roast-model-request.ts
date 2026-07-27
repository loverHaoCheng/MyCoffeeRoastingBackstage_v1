import { aiRoastProvider } from '../config.js';

export interface RoastModelMessage {
  content: string;
  role: 'system' | 'user';
}

/**
 * 按服务商差异构建 Chat Completions 请求体。
 *
 * OpenAI 新一代模型（GPT-5 系列等）已不接受 `max_tokens`，
 * 需改用 `max_completion_tokens`；部分模型也不允许自定义 `temperature`。
 * 七牛云等 OpenAI 兼容网关仍使用传统的 `max_tokens` + `temperature`。
 */
export const buildRoastModelRequestBody = (
  messages: RoastModelMessage[],
  model: string,
  maxTokens: number,
  temperature: number,
): Record<string, unknown> => {
  if (aiRoastProvider === 'openai') {
    return {
      max_completion_tokens: maxTokens,
      messages,
      model,
    };
  }

  return {
    max_tokens: maxTokens,
    messages,
    model,
    temperature,
  };
};
