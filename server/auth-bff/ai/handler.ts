import type { IncomingMessage, ServerResponse } from 'node:http';

import { refreshAuthenticatedSession } from '../auth-common.js';
import { AI_FEATURE_BEAN_IMAGE_RECOGNITION } from '../config.js';
import { sendApiError, sendApiSuccess } from '../http.js';
import { normalizeErrorPayload } from '../pocketbase-client.js';
import type { AiUsageState } from '../types.js';
import { PocketBaseGatewayError } from '../types.js';
import { parseImageRecognitionRequest, requestQiniuBeanImageRecognition } from './qiniu-client.js';
import { createAiUsageLog, formatShanghaiMonth, getRequiredSuperuserToken, logAiRecognitionFailure, readBeanImageRecognitionUsageState } from './usage-service.js';

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
    const message =
      error instanceof PocketBaseGatewayError
        ? normalizeErrorPayload(error.payload).message ?? error.message
        : 'PocketBase 管理员登录失败，无法使用 AI 识别。';

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
    const recognition = await requestQiniuBeanImageRecognition(imageDataUrl);

    await createAiUsageLog(superuserToken, {
      feature: AI_FEATURE_BEAN_IMAGE_RECOGNITION,
      month,
      ownerId,
      status: 'success',
    });

    const nextUsedThisMonth = usageState.usedThisMonth + 1;

    sendApiSuccess(response, {
      monthlyLimit: usageState.monthlyLimit,
      recognition,
      remainingUses: Math.max(usageState.monthlyLimit - nextUsedThisMonth, 0),
      usedThisMonth: nextUsedThisMonth,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 图片识别失败。';

    await logAiRecognitionFailure(superuserToken, {
      errorMessage: message,
      month,
      ownerId,
    });
    sendApiError(response, 502, message);
  }
};
