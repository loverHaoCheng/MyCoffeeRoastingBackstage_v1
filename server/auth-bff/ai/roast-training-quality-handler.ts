import type { IncomingMessage, ServerResponse } from 'node:http';

import { sendJson } from '../http.js';
import { authorizeInternalJobRequest } from '../internal-jobs-auth.js';
import { normalizeErrorPayload } from '../pocketbase-client.js';
import { PocketBaseGatewayError } from '../types.js';
import { getRequiredSuperuserToken } from './usage-service.js';
import {
  checkAndUpdateRoastTrainingSampleQuality,
  getPocketBaseGatewayMessage,
  listPendingRoastTrainingSamples,
} from './roast-training-quality-service.js';

export const handleRoastTrainingQualityCheck = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  if (!authorizeInternalJobRequest(request, response)) {
    return;
  }

  try {
    const superuserToken = await getRequiredSuperuserToken();
    const samples = await listPendingRoastTrainingSamples(superuserToken);
    let failedCount = 0;
    let passedCount = 0;

    for (const sample of samples) {
      const result = await checkAndUpdateRoastTrainingSampleQuality(superuserToken, sample);

      if (result.status === 'passed') {
        passedCount += 1;
      } else {
        failedCount += 1;
      }
    }

    sendJson(response, 200, {
      checkedCount: samples.length,
      failedCount,
      passedCount,
    });
  } catch (error) {
    const upstreamError = error instanceof PocketBaseGatewayError ? error : null;
    const message = upstreamError
      ? getPocketBaseGatewayMessage(upstreamError, upstreamError.message)
      : '训练样本质量检查任务执行失败。';

    sendJson(response, upstreamError?.status ?? 500, {
      data: upstreamError ? normalizeErrorPayload(upstreamError.payload).data ?? {} : {},
      message,
    });
  }
};
