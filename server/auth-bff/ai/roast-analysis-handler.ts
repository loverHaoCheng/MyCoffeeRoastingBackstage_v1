import type { IncomingMessage, ServerResponse } from 'node:http';

import { refreshAuthenticatedSession } from '../auth-common.js';
import { isStagingAppEnv } from '../config.js';
import { sendApiError, sendApiSuccess } from '../http.js';
import { normalizeErrorPayload, proxyPocketBaseRequest } from '../pocketbase-client.js';
import { escapeFilterValue, getFirstListItem, listPocketBaseRecords } from '../record-utils.js';
import { PocketBaseGatewayError } from '../types.js';
import { isRecord, toTrimmedString } from '../utils.js';
import { parseRoastAnalysisRequest } from './roast-analysis-types.js';
import { requestRoastAnalysis } from './roast-analysis-client.js';

const getGenerationModel = (record: Record<string, unknown>): string => {
  return isRecord(record.generation_meta) ? toTrimmedString(record.generation_meta.model) : '';
};

export const handleRoastAnalysis = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  if (!isStagingAppEnv()) {
    sendApiError(response, 403, '正式环境暂未开放 AI 曲线复盘。');
    return;
  }

  const session = await refreshAuthenticatedSession(request, response);

  if (!session) {
    return;
  }

  let input;

  try {
    input = await parseRoastAnalysisRequest(request);
  } catch (error) {
    sendApiError(response, 400, error instanceof Error ? error.message : '烘焙 AI 请求参数无效。');
    return;
  }

  try {
    const existingPayload = await listPocketBaseRecords(session.token, 'ai_roast_reviews', {
      fields: '*',
      filter: `owner = ${escapeFilterValue(session.record.id)} && roast_batch_id = ${escapeFilterValue(input.roastBatchId)}`,
      perPage: 1,
    });
    const existing = getFirstListItem(existingPayload);

    if (existing && isRecord(existing.analysis_result)) {
      sendApiSuccess(response, {
        alreadyReviewed: true,
        analysis: existing.analysis_result,
        model: getGenerationModel(existing),
        reviewId: toTrimmedString(existing.id),
      });
      return;
    }

    const analysis = await requestRoastAnalysis(input);

    const created = await proxyPocketBaseRequest('/api/collections/ai_roast_reviews/records', {
      body: JSON.stringify({
        analysis_result: analysis,
        curve_record_id: input.curveRecordId,
        generation_meta: { generatedAt: new Date().toISOString(), model: process.env.AI_ROAST_MODEL?.trim() ?? '' },
        input_snapshot: input,
        machine_id: input.machineId,
        owner: session.record.id,
        roast_batch_id: input.roastBatchId,
      }),
      headers: { Accept: 'application/json', Authorization: session.token, 'Content-Type': 'application/json' },
      method: 'POST',
    });

    if (!created.response.ok) {
      throw new PocketBaseGatewayError(created.response.status, created.payload);
    }

    sendApiSuccess(response, {
      alreadyReviewed: false,
      analysis,
      model: process.env.AI_ROAST_MODEL?.trim() ?? '',
      reviewId: isRecord(created.payload) ? toTrimmedString(created.payload.id) : undefined,
    });
  } catch (error) {
    if (error instanceof PocketBaseGatewayError) {
      sendApiError(response, error.status, normalizeErrorPayload(error.payload).message ?? 'AI 复盘保存失败。');
      return;
    }
    sendApiError(response, 502, error instanceof Error ? error.message : '烘焙 AI 分析失败。');
  }
};

export const handleRoastAnalysisStatus = async (request: IncomingMessage, response: ServerResponse, requestUrl: URL): Promise<void> => {
  if (!isStagingAppEnv()) {
    sendApiError(response, 403, '正式环境暂未开放 AI 曲线复盘。');
    return;
  }

  const session = await refreshAuthenticatedSession(request, response);
  if (!session) return;
  const roastBatchId = toTrimmedString(requestUrl.searchParams.get('roastBatchId'));
  if (!roastBatchId) {
    sendApiError(response, 400, '缺少烘焙记录 ID。');
    return;
  }
  try {
    const payload = await listPocketBaseRecords(session.token, 'ai_roast_reviews', {
      fields: '*',
      filter: `owner = ${escapeFilterValue(session.record.id)} && roast_batch_id = ${escapeFilterValue(roastBatchId)}`,
      perPage: 1,
    });
    const review = getFirstListItem(payload);
    sendApiSuccess(response, {
      analysis: review && isRecord(review.analysis_result) ? review.analysis_result : null,
      model: review ? getGenerationModel(review) : '',
      reviewed: review != null,
      reviewId: review ? toTrimmedString(review.id) : undefined,
    });
  } catch (error) {
    sendApiError(response, 502, error instanceof Error ? error.message : 'AI 复盘状态读取失败。');
  }
};
