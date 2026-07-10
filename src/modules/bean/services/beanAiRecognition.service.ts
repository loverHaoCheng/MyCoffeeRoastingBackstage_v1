import { resolveHttpClientAbsoluteUrl, resolveHttpClientUrl } from '@/services/httpClient';
import type { ApiResponse } from '@/services/api.types';
import { AppError } from '@/shared/errors/AppError';

import type {
  BeanImageRecognitionResponse,
  BeanImageRecognitionUsage,
} from '../types/beanAiRecognition';

const aiRecognitionPath = '/ai/bean-image-recognition';
const gatewayHealthPath = '/health';

export const getBeanAiRecognitionRequestUrl = (): string => {
  return resolveHttpClientAbsoluteUrl(aiRecognitionPath);
};

export const getAiGatewayHealthUrl = (): string => {
  return resolveHttpClientAbsoluteUrl(gatewayHealthPath);
};

const isBeanImageRecognitionResponse = (value: unknown): value is BeanImageRecognitionResponse => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<BeanImageRecognitionResponse>;

  return (
    typeof candidate.monthlyLimit === 'number' &&
    typeof candidate.remainingUses === 'number' &&
    typeof candidate.usedThisMonth === 'number' &&
    typeof candidate.recognition === 'object'
  );
};

const isBeanImageRecognitionUsage = (value: unknown): value is BeanImageRecognitionUsage => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<BeanImageRecognitionUsage>;

  return (
    typeof candidate.enabled === 'boolean' &&
    typeof candidate.monthlyLimit === 'number' &&
    typeof candidate.remainingUses === 'number' &&
    typeof candidate.usedThisMonth === 'number'
  );
};

const parseApiResponse = async (response: Response): Promise<ApiResponse<unknown>> => {
  const text = await response.text();

  if (!text) {
    throw new AppError('AI 图片识别接口返回为空。', {
      code: 'UNKNOWN',
      status: response.status,
    });
  }

  try {
    return JSON.parse(text) as ApiResponse<unknown>;
  } catch (error) {
    throw new AppError('AI 图片识别接口返回了无法解析的数据。', {
      code: 'UNKNOWN',
      status: response.status,
      cause: error,
    });
  }
};

const getPayloadMessage = (payload: unknown): string => {
  if (typeof payload !== 'object' || payload === null) {
    return '';
  }

  const candidate = payload as { message?: unknown };

  return typeof candidate.message === 'string' ? candidate.message.trim() : '';
};

export const beanAiRecognitionService = {
  async getUsage(): Promise<BeanImageRecognitionUsage> {
    let response: Response;

    try {
      response = await fetch(resolveHttpClientUrl(aiRecognitionPath), {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
        method: 'GET',
      });
    } catch (error) {
      throw new AppError('网络连接异常，请稍后重试。', {
        code: 'NETWORK',
        cause: error,
      });
    }

    const payload = await parseApiResponse(response);

    if (!response.ok) {
      throw new AppError(getPayloadMessage(payload) || `请求失败：${String(response.status)}`, {
        code: 'HTTP',
        status: response.status,
        cause: payload,
      });
    }

    if (payload.code !== 0) {
      throw new AppError(payload.message || 'AI 图片识别额度读取失败。', {
        code: 'BUSINESS',
        status: response.status,
        cause: payload,
      });
    }

    if (!isBeanImageRecognitionUsage(payload.data)) {
      throw new AppError('AI 图片识别额度接口返回格式不符合约定。', {
        code: 'UNKNOWN',
        status: response.status,
        cause: payload,
      });
    }

    return payload.data;
  },

  async recognizeImage(imageBlob: Blob): Promise<BeanImageRecognitionResponse> {
    let response: Response;

    try {
      response = await fetch(resolveHttpClientUrl(aiRecognitionPath), {
        body: imageBlob,
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': imageBlob.type || 'image/jpeg',
        },
        method: 'POST',
      });
    } catch (error) {
      throw new AppError('网络连接异常，请稍后重试。', {
        code: 'NETWORK',
        cause: error,
      });
    }

    const payload = await parseApiResponse(response);

    if (!response.ok) {
      throw new AppError(getPayloadMessage(payload) || `请求失败：${String(response.status)}`, {
        code: 'HTTP',
        status: response.status,
        cause: payload,
      });
    }

    if (payload.code !== 0) {
      throw new AppError(payload.message || 'AI 图片识别失败。', {
        code: 'BUSINESS',
        status: response.status,
        cause: payload,
      });
    }

    if (!isBeanImageRecognitionResponse(payload.data)) {
      throw new AppError('AI 图片识别接口返回格式不符合约定。', {
        code: 'UNKNOWN',
        status: response.status,
        cause: payload,
      });
    }

    return payload.data;
  },

  async checkGatewayHealth(): Promise<void> {
    let response: Response;

    try {
      response = await fetch(resolveHttpClientUrl(gatewayHealthPath), {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
        method: 'GET',
      });
    } catch (error) {
      throw new AppError('无法连接到当前页面同源的 AI 网关健康检查地址。', {
        code: 'NETWORK',
        cause: error,
      });
    }

    if (!response.ok) {
      throw new AppError(`AI 网关健康检查失败：HTTP ${String(response.status)}。`, {
        code: 'HTTP',
        status: response.status,
      });
    }
  },
};
