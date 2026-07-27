import type { IncomingMessage, ServerResponse } from 'node:http';
import { refreshAuthenticatedSession } from '../auth-common.js';
import { AI_FEATURE_ROASTER_MODEL_RECOGNITION } from '../config.js';
import { sendApiError, sendApiSuccess } from '../http.js';
import { normalizeErrorPayload } from '../pocketbase-client.js';
import { PocketBaseGatewayError } from '../types.js';
import { parseImageRecognitionRequest, requestQiniuRoasterModelRecognition } from './qiniu-client.js';
import {
  formatShanghaiMonth,
  getRequiredSuperuserToken,
  readAiUsageState,
  releaseAiUsageReservation,
  reserveAiUsage,
} from './usage-service.js';

export const handleRoasterModelRecognition = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const authResponse = await refreshAuthenticatedSession(request, response);

  if (!authResponse) return;

  const ownerId = authResponse.record.id;
  const month = formatShanghaiMonth(new Date());
  let reservationLogId = '';
  let superuserToken = '';

  try {
    superuserToken = await getRequiredSuperuserToken();
    const usageState = await readAiUsageState(superuserToken, ownerId, AI_FEATURE_ROASTER_MODEL_RECOGNITION, month);

    if (!usageState.enabled) {
      sendApiError(response, 403, '当前账号的烘焙机参数识别功能已关闭。');
      return;
    }

    if (usageState.remainingUses <= 0) {
      sendApiError(response, 429, '本月烘焙机参数识别次数已用完。');
      return;
    }

    const { imageDataUrl } = await parseImageRecognitionRequest(request);
    const reservation = await reserveAiUsage(
      superuserToken,
      ownerId,
      AI_FEATURE_ROASTER_MODEL_RECOGNITION,
      month,
    );
    reservationLogId = reservation.logId;
    sendApiSuccess(response, await requestQiniuRoasterModelRecognition(imageDataUrl));
  } catch (error) {
    if (reservationLogId) {
      await releaseAiUsageReservation(superuserToken, reservationLogId, '烘焙机参数识别失败。').catch(() => undefined);
    }

    const statusCode = error instanceof PocketBaseGatewayError ? error.status : 502;
    const message =
      error instanceof PocketBaseGatewayError
        ? normalizeErrorPayload(error.payload).message ?? '烘焙机参数识别服务暂时不可用。'
        : '烘焙机参数识别服务暂时不可用。';
    sendApiError(response, statusCode, message);
  }
};
