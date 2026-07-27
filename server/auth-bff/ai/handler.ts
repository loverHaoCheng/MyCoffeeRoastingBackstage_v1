import type { IncomingMessage, ServerResponse } from 'node:http';

import { refreshAuthenticatedSession } from '../auth-common.js';
import { AI_FEATURE_BEAN_IMAGE_RECOGNITION } from '../config.js';
import { sendApiError, sendApiSuccess } from '../http.js';
import { normalizeErrorPayload } from '../pocketbase-client.js';
import type { AiUsageState } from '../types.js';
import { PocketBaseGatewayError } from '../types.js';
import { parseImageRecognitionRequest, requestQiniuBeanImageRecognition } from './qiniu-client.js';
import {
  formatShanghaiMonth,
  getRequiredSuperuserToken,
  logAiRecognitionFailure,
  readBeanImageRecognitionUsageState,
  releaseAiUsageReservation,
  reserveAiUsage,
} from './usage-service.js';

export const handleBeanImageRecognitionUsage = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const authResponse = await refreshAuthenticatedSession(request, response);

  if (!authResponse) {
    return;
  }

  let superuserToken = '';

  try {
    superuserToken = await getRequiredSuperuserToken();
  } catch (error) {
    const statusCode = error instanceof PocketBaseGatewayError ? error.status : 500;
    const rawMessage =
      error instanceof PocketBaseGatewayError
        ? normalizeErrorPayload(error.payload).message ?? error.message
        : 'PocketBase 管理员登录失败，无法使用 AI 识别。';
    const message = rawMessage.replace('AI 功能', 'AI 识别');

    sendApiError(response, statusCode, message);
    return;
  }

  const month = formatShanghaiMonth(new Date());
  const ownerId = authResponse.record.id;
  let usageState: AiUsageState;

  try {
    usageState = await readBeanImageRecognitionUsageState(superuserToken, ownerId, month);
  } catch (error) {
    const statusCode = error instanceof PocketBaseGatewayError ? error.status : 500;
    const message =
      error instanceof PocketBaseGatewayError
        ? normalizeErrorPayload(error.payload).message ?? error.message
        : 'AI 使用额度读取失败。';

    sendApiError(response, statusCode, message);
    return;
  }

  if (request.method === 'GET') {
    sendApiSuccess(response, usageState);
    return;
  }

  if (!usageState.enabled) {
    sendApiError(response, 403, '当前账号的 AI 图片识别功能已关闭。', {
      monthlyLimit: usageState.monthlyLimit,
      remainingUses: 0,
      usedThisMonth: usageState.usedThisMonth,
    });
    return;
  }

  if (usageState.remainingUses <= 0) {
    sendApiError(response, 429, '本月 AI 图片识别次数已用完。', {
      monthlyLimit: usageState.monthlyLimit,
      remainingUses: 0,
      usedThisMonth: usageState.usedThisMonth,
    });
    return;
  }

  let imageDataUrl = '';
  let reservationLogId = '';

  try {
    imageDataUrl = (await parseImageRecognitionRequest(request)).imageDataUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 图片识别请求参数无效。';

    await logAiRecognitionFailure(superuserToken, {
      errorMessage: message,
      month,
      ownerId,
    });
    sendApiError(response, 400, message);
    return;
  }

  try {
    const reservation = await reserveAiUsage(
      superuserToken,
      ownerId,
      AI_FEATURE_BEAN_IMAGE_RECOGNITION,
      month,
    );
    reservationLogId = reservation.logId;
    usageState = reservation.state;
    const recognition = await requestQiniuBeanImageRecognition(imageDataUrl);

    sendApiSuccess(response, {
      monthlyLimit: usageState.monthlyLimit,
      recognition,
      remainingUses: usageState.remainingUses,
      usedThisMonth: usageState.usedThisMonth,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 图片识别失败。';

    if (reservationLogId) {
      await releaseAiUsageReservation(superuserToken, reservationLogId, message).catch(() => {
        // 预占记录无法释放时保守保留已占用次数，避免并发请求突破额度上限。
      });
    } else {
      await logAiRecognitionFailure(superuserToken, {
        errorMessage: message,
        month,
        ownerId,
      });
    }
    sendApiError(response, 502, message);
  }
};
