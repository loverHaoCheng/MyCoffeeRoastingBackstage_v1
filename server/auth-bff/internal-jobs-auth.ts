import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { sendJson } from './http.js';

export const INTERNAL_JOBS_TOKEN_HEADER = 'x-internal-jobs-token';

const readConfiguredInternalJobsToken = (): string => {
  return (process.env.INTERNAL_JOBS_TOKEN ?? '').trim();
};

const isTokenMatch = (provided: string, expected: string): boolean => {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
};

/**
 * 内部任务端点鉴权。
 *
 * 背景：BFF 运行在 Nginx 反向代理之后，所有经代理转发的公网请求
 * 其 `socket.remoteAddress` 都是回环地址，因此“仅允许 127.0.0.1”
 * 这类来源校验在该部署形态下不构成任何保护。
 *
 * 改为共享密钥方案：调用方必须携带 `X-Internal-Jobs-Token` 请求头，
 * 其值与服务端环境变量 `INTERNAL_JOBS_TOKEN` 一致才放行。
 * 未配置该环境变量时，内部任务端点整体禁用（返回 404）。
 */
export const authorizeInternalJobRequest = (
  request: IncomingMessage,
  response: ServerResponse,
): boolean => {
  const expectedToken = readConfiguredInternalJobsToken();

  if (!expectedToken) {
    sendJson(response, 404, {
      message: 'Not Found',
    });
    return false;
  }

  const providedHeader = request.headers[INTERNAL_JOBS_TOKEN_HEADER];
  const providedToken = typeof providedHeader === 'string' ? providedHeader.trim() : '';

  if (!providedToken || !isTokenMatch(providedToken, expectedToken)) {
    sendJson(response, 403, {
      message: 'Forbidden',
    });
    return false;
  }

  return true;
};
