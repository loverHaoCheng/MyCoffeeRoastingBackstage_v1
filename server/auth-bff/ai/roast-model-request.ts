import { aiRoastProvider } from '../config.js';

export interface RoastModelMessage {
  content: string;
  role: 'system' | 'user';
}

export const isAnthropicRoastProvider = (): boolean => aiRoastProvider === 'anthropic';

export const supportsRoastModelJsonObjectResponse = (): boolean => !isAnthropicRoastProvider();

export const getRoastModelRequestPath = (): string => {
  return isAnthropicRoastProvider() ? '/messages' : '/chat/completions';
};

export const getRoastModelRequestHeaders = (apiKey: string): Record<string, string> => {
  if (isAnthropicRoastProvider()) {
    return {
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    };
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
};

/**
 * 按服务商差异构建烘焙 AI 请求体。
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
  stream = false,
): Record<string, unknown> => {
  if (isAnthropicRoastProvider()) {
    const system = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')
      .trim();

    return {
      max_tokens: maxTokens,
      messages: messages
        .filter((message) => message.role !== 'system')
        .map(({ content, role }) => ({ content, role })),
      model,
      ...(system ? { system } : {}),
      ...(stream ? { stream: true } : {}),
    };
  }

  if (aiRoastProvider === 'openai') {
    return {
      max_completion_tokens: maxTokens,
      messages,
      model,
      ...(stream ? { stream: true } : {}),
    };
  }

  return {
    max_tokens: maxTokens,
    messages,
    model,
    temperature,
    ...(stream ? { stream: true } : {}),
  };
};
