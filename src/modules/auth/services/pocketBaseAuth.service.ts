import {
  pocketBaseSessionService,
  type PocketBaseSession,
  type PocketBaseSessionUser,
} from '@/services/pocketBaseSession.service';
import { normalizePocketBaseBaseUrl, resolvePocketBaseBaseUrl } from '@/services/pocketBaseConfig';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger/logger';

import type {
  AuthAccountDeletionResult,
  AuthCredentialsInput,
  AuthEmailActionResult,
  PocketBaseUserRecord,
  RegisterInput,
  RegisterResult,
} from '../types';

interface PocketBaseAuthResponse {
  record?: PocketBaseUserRecord;
  token?: string;
}

interface PocketBaseErrorField {
  code?: string;
  message?: string;
}

interface PocketBaseErrorPayload {
  data?: Record<string, PocketBaseErrorField>;
  message?: string;
}

const parseResponseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (!response.ok) {
      const isHtmlErrorPage = text.trimStart().startsWith('<');

      return {
        message: isHtmlErrorPage
          ? '登录网关返回了非 JSON 错误页面，请确认开发服务已启动，或服务器已正确转发 /api/auth。'
          : '登录网关返回了无法解析的错误响应。',
      } satisfies PocketBaseErrorPayload;
    }

    throw new AppError('PocketBase 返回了无法解析的数据。', {
      code: 'DATA',
      status: response.status,
      cause: error,
    });
  }
};

const normalizeUser = (record: PocketBaseUserRecord): PocketBaseSessionUser => {
  return {
    email: record.email,
    id: record.id,
    name: record.name?.trim() ? record.name.trim() : undefined,
    verified: record.verified,
    username: record.username,
  };
};

const parseErrorPayload = (payload: unknown): PocketBaseErrorPayload => {
  if (typeof payload !== 'object' || payload == null) {
    return {};
  }

  const record = payload as Record<string, unknown>;
  const rawData =
    typeof record.data === 'object' && record.data != null ? (record.data as Record<string, unknown>) : {};
  const data = Object.fromEntries(
    Object.entries(rawData).map(([fieldName, value]) => {
      const fieldRecord = typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {};

      return [
        fieldName,
        {
          code: typeof fieldRecord.code === 'string' ? fieldRecord.code : undefined,
          message: typeof fieldRecord.message === 'string' ? fieldRecord.message : undefined,
        } satisfies PocketBaseErrorField,
      ];
    }),
  );

  return {
    data,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
};

const AUTH_FIELD_LABELS: Record<string, string> = {
  email: '邮箱',
  password: '密码',
  passwordConfirm: '确认密码',
};

const translateFieldIssue = (fieldName: string, issue: PocketBaseErrorField): string | null => {
  const label = AUTH_FIELD_LABELS[fieldName] ?? fieldName;
  const message = issue.message?.trim();
  const code = issue.code?.trim().toLowerCase();
  const normalizedMessage = message?.toLowerCase() ?? '';

  if (fieldName === 'email') {
    if (code === 'validation_not_unique' || normalizedMessage.includes('already in use')) {
      return '注册失败，该邮箱已被使用，请更换后重试。';
    }

    if (normalizedMessage.includes('invalid')) {
      return '注册失败，邮箱格式不正确，请检查后重试。';
    }
  }

  if (fieldName === 'passwordConfirm') {
    if (normalizedMessage.includes('equal to') || normalizedMessage.includes('same as')) {
      return '注册失败，两次输入的密码不一致，请重新确认。';
    }
  }

  if (code === 'validation_required' || normalizedMessage.includes('required')) {
    return `注册失败，请填写${label}。`;
  }

  if (normalizedMessage.includes('must be at least') || normalizedMessage.includes('too short')) {
    return `注册失败，${label}长度不足，请按要求填写。`;
  }

  if (!message) {
    return null;
  }

  return `${label}校验失败：${message}`;
};

const getBusinessErrorMessage = (payload: unknown): string => {
  const pocketBaseError = parseErrorPayload(payload);
  const fieldIssues = pocketBaseError.data
    ? Object.entries(pocketBaseError.data)
        .map(([fieldName, issue]) => translateFieldIssue(fieldName, issue))
        .filter((message): message is string => Boolean(message))
    : [];

  if (fieldIssues.length > 0) {
    return fieldIssues.join('；');
  }

  const message = pocketBaseError.message?.trim() ?? '';
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('failed to create record')) {
    return '注册失败，提交的信息未通过 PocketBase 校验，请检查邮箱和密码后重试。';
  }

  return message || 'PocketBase 提交的数据未通过校验，请检查后重试。';
};

const getAuthFailureMessage = (payload: unknown): string => {
  const pocketBaseError = parseErrorPayload(payload);
  const message = pocketBaseError.message?.trim() ?? '';
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes('failed to authenticate') ||
    normalizedMessage.includes('identity or password') ||
    normalizedMessage.includes('invalid login')
  ) {
    return '登录失败，邮箱或密码不正确，请重新输入。';
  }

  return message || 'PocketBase 鉴权失败，请确认账号信息后重试。';
};

const isCredentialFailurePayload = (payload: unknown): boolean => {
  const message = parseErrorPayload(payload).message?.trim().toLowerCase() ?? '';

  return (
    message.includes('failed to authenticate') ||
    message.includes('identity or password') ||
    message.includes('invalid login')
  );
};

const toAuthError = (response: Response, payload: unknown): AppError => {
  const payloadMessage = parseErrorPayload(payload).message?.trim();
  const defaultMessage =
    payloadMessage && payloadMessage.length > 0 ? payloadMessage : `PocketBase 请求失败：${String(response.status)}`;

  if (response.status === 400) {
    if (isCredentialFailurePayload(payload)) {
      return new AppError(getAuthFailureMessage(payload), {
        code: 'AUTH',
        status: response.status,
        cause: payload,
      });
    }

    return new AppError(getBusinessErrorMessage(payload), {
      code: 'BUSINESS',
      status: response.status,
      cause: payload,
    });
  }

  if (response.status === 401 || response.status === 403) {
    return new AppError(getAuthFailureMessage(payload), {
      code: 'AUTH',
      status: response.status,
      cause: payload,
    });
  }

  if (response.status >= 500) {
    const message = defaultMessage.includes('非 JSON 错误页面')
      ? defaultMessage
      : '登录网关暂时不可用，请稍后重试。';

    return new AppError(message, {
      code: 'HTTP',
      status: response.status,
      cause: payload,
    });
  }

  return new AppError(defaultMessage, {
    code: 'HTTP',
    status: response.status,
    cause: payload,
  });
};

const toNetworkError = (error: unknown, url: string): AppError => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AppError('鉴权请求超时，请检查当前网络，或确认 PocketBase 服务是否正常响应。', {
      code: 'TIMEOUT',
      cause: error,
    });
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return new AppError('当前网络不可用，无法连接到 PocketBase 鉴权服务。', {
      code: 'NETWORK',
      cause: error,
    });
  }

  return new AppError(
    `无法连接到登录网关（${url}），请检查服务是否启动、当前网络是否可用，或确认 Nginx 是否已转发 /api/auth。`,
    {
      code: 'NETWORK',
      cause: error,
    },
  );
};

const buildAuthGatewayUrl = (path: string): string => {
  return `/api/auth${path}`;
};

const requestJson = async (
  url: string,
  options: RequestInit,
): Promise<unknown> => {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
    });

    const payload = await parseResponseJson(response);

    if (!response.ok) {
      throw toAuthError(response, payload);
    }

    if (typeof payload !== 'object' || payload == null) {
      throw new AppError('PocketBase 认证返回的数据不正确。', {
        code: 'DATA',
        status: response.status,
        cause: payload,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw toNetworkError(error, url);
  }
};

const postJson = async (path: string, body: Record<string, unknown>): Promise<unknown> => {
  return requestJson(buildAuthGatewayUrl(path), {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    method: 'POST',
  });
};

const patchJson = async (path: string, body: Record<string, unknown>): Promise<unknown> => {
  return requestJson(buildAuthGatewayUrl(path), {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    method: 'PATCH',
  });
};

const deleteJson = async (path: string): Promise<unknown> => {
  return requestJson(buildAuthGatewayUrl(path), {
    headers: {
      Accept: 'application/json',
    },
    method: 'DELETE',
  });
};

const getSessionFromAuthResponse = (response: PocketBaseAuthResponse): PocketBaseSession => {
  if (!response.token || !response.record) {
    throw new AppError('PocketBase 认证响应缺少必要字段。', {
      code: 'DATA',
      cause: response,
    });
  }

  return pocketBaseSessionService.save({
    baseUrl: normalizePocketBaseBaseUrl(
      pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean').projectUrl.trim() ||
        resolvePocketBaseBaseUrl(),
    ),
    token: response.token,
    user: normalizeUser(response.record),
  });
};

export const pocketBaseAuthService = {
  async register(input: RegisterInput): Promise<RegisterResult> {
    return (await postJson('/register', {
      email: input.email.trim(),
      password: input.password,
      passwordConfirm: input.passwordConfirm,
    })) as RegisterResult;
  },
  async login(input: AuthCredentialsInput): Promise<PocketBaseSession> {
    const response = (await postJson('/login', {
      identity: input.email.trim(),
      password: input.password,
    })) as PocketBaseAuthResponse;

    return getSessionFromAuthResponse(response);
  },
  async restoreSession(): Promise<PocketBaseSession | null> {
    const response = (await requestJson(buildAuthGatewayUrl('/session'), {
      headers: {
        Accept: 'application/json',
      },
      method: 'GET',
    })) as PocketBaseAuthResponse;

    if (!response.record || !response.token) {
      return null;
    }

    return getSessionFromAuthResponse(response);
  },
  async updateProfileName(name: string): Promise<PocketBaseSession> {
    const response = (await patchJson('/profile', {
      name: name.trim(),
    })) as PocketBaseAuthResponse;

    return getSessionFromAuthResponse(response);
  },
  async logout(): Promise<void> {
    try {
      await requestJson(buildAuthGatewayUrl('/logout'), {
        headers: {
          Accept: 'application/json',
        },
        method: 'POST',
      });
    } catch (error) {
      logger.warn('pocketbase logout gateway request failed', {
        error,
      });
    } finally {
      pocketBaseSessionService.clear();
      logger.info('pocketbase session cleared');
    }
  },
  async deleteAccount(): Promise<AuthAccountDeletionResult> {
    const result = (await deleteJson('/account')) as AuthAccountDeletionResult;

    pocketBaseSessionService.clear();
    logger.info('pocketbase account deleted and session cleared');

    return result;
  },
  loadSession(): PocketBaseSession | null {
    return pocketBaseSessionService.load();
  },
  async requestPasswordReset(email: string): Promise<AuthEmailActionResult> {
    return (await postJson('/request-password-reset', {
      email: email.trim(),
    })) as AuthEmailActionResult;
  },
  async requestVerification(email: string): Promise<AuthEmailActionResult> {
    return (await postJson('/request-verification', {
      email: email.trim(),
    })) as AuthEmailActionResult;
  },
};
