import type { IncomingMessage, ServerResponse } from 'node:http';
import { refreshAuthenticatedSession } from '../auth-common.js';
import { sendApiError, sendApiSuccess } from '../http.js';
import { parseImageRecognitionRequest, requestQiniuRoasterModelRecognition } from './qiniu-client.js';

export const handleRoasterModelRecognition = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  if (!await refreshAuthenticatedSession(request, response)) return;
  try {
    const { imageDataUrl } = await parseImageRecognitionRequest(request);
    sendApiSuccess(response, await requestQiniuRoasterModelRecognition(imageDataUrl));
  } catch (error) {
    sendApiError(response, 502, error instanceof Error ? error.message : '烘焙机参数识别失败。');
  }
};
