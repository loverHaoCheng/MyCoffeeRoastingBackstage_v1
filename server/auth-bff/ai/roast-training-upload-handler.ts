import type { IncomingMessage, ServerResponse } from 'node:http';

import { refreshAuthenticatedSession } from '../auth-common.js';
import { isStagingAppEnv } from '../config.js';
import { parseJsonBody, sendApiError, sendApiSuccess } from '../http.js';
import { normalizeErrorPayload, proxyPocketBaseRequest } from '../pocketbase-client.js';
import { escapeFilterValue, getFirstListItem, isOptionalCollectionMissing, listPocketBaseRecords } from '../record-utils.js';
import { PocketBaseGatewayError } from '../types.js';
import { isRecord, toTrimmedString } from '../utils.js';
import { checkAndUpdateRoastTrainingSampleQuality, TRAINING_SAMPLES_COLLECTION } from './roast-training-quality-service.js';

const TRAINING_UPLOADS_COLLECTION = 'roast_training_uploads';
const ROAST_BATCHES_COLLECTION = 'roast_batches';
const ROAST_CURVES_COLLECTION = 'roast_curve_records';
const ROAST_PLANS_COLLECTION = 'roast_profiles';
const GREEN_BEANS_COLLECTION = 'green_beans';

interface TrainingReadinessItem {
  key: 'bean' | 'consent' | 'curve' | 'evaluation' | 'roastPlan' | 'target';
  label: string;
  ready: boolean;
}

interface TrainingReadiness {
  isUploadReady: boolean;
  items: TrainingReadinessItem[];
  missingLabels: string[];
}

interface TrainingUploadStatus {
  alreadyUploaded: boolean;
  disabledReason?: string;
  enabled: boolean;
  environment: string;
  readiness?: TrainingReadiness;
  roastBatchId: string;
  uploadId?: string;
}

const hasText = (value: unknown): boolean => {
  return typeof value === 'string' && value.trim().length > 0;
};

const buildDuplicateUploadFilter = (ownerId: string, roastBatchId: string): string => {
  return [
    `owner = ${escapeFilterValue(ownerId)}`,
    `roast_batch_id = ${escapeFilterValue(roastBatchId)}`,
  ].join(' && ');
};

const getEvaluationRecord = (batch: Record<string, unknown>): Record<string, unknown> => {
  return isRecord(batch.evaluation) ? batch.evaluation : {};
};

const isEvaluationReady = (evaluation: Record<string, unknown>): boolean => {
  const hasOverallScore = typeof evaluation.overallScore === 'number' && Number.isFinite(evaluation.overallScore);
  const hasTargetMatchScore =
    typeof evaluation.targetMatchScore === 'number' && Number.isFinite(evaluation.targetMatchScore);
  const hasReviewNotes =
    hasText(evaluation.flavorNotes) ||
    hasText(evaluation.defectNotes) ||
    hasText(evaluation.nextAdjustmentNotes);

  return hasOverallScore && hasTargetMatchScore && hasReviewNotes;
};

const buildReadiness = (
  batch: Record<string, unknown>,
  curve: Record<string, unknown> | null,
): TrainingReadiness => {
  const evaluation = getEvaluationRecord(batch);
  const items: TrainingReadinessItem[] = [
    {
      key: 'bean',
      label: '生豆信息',
      ready: hasText(batch.green_bean_id) && hasText(batch.green_bean_name),
    },
    {
      key: 'roastPlan',
      label: '烘焙计划',
      ready: hasText(batch.roast_plan_id) || hasText(batch.roast_plan_name),
    },
    {
      key: 'target',
      label: '目标条件',
      ready: hasText(batch.roast_level),
    },
    {
      key: 'curve',
      label: '曲线数据',
      ready: curve != null,
    },
    {
      key: 'evaluation',
      label: '评价表单',
      ready: isEvaluationReady(evaluation),
    },
    {
      key: 'consent',
      label: '训练授权',
      ready: evaluation.allowTraining === true,
    },
  ];
  const missingLabels = items.filter((item) => !item.ready).map((item) => item.label);

  return {
    isUploadReady: missingLabels.length === 0,
    items,
    missingLabels,
  };
};

const getRecordById = async (
  token: string,
  collectionName: string,
  recordId: string,
): Promise<Record<string, unknown> | null> => {
  if (!recordId) {
    return null;
  }

  const upstream = await proxyPocketBaseRequest(`/api/collections/${collectionName}/records/${recordId}`, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'GET',
  });

  if (upstream.response.status === 404) {
    return null;
  }

  if (!upstream.response.ok) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }

  return isRecord(upstream.payload) ? upstream.payload : null;
};

const getCurveByBatchId = async (
  token: string,
  roastBatchId: string,
): Promise<Record<string, unknown> | null> => {
  const payload = await listPocketBaseRecords(token, ROAST_CURVES_COLLECTION, {
    fields: '*',
    filter: `roast_batch_id = ${escapeFilterValue(roastBatchId)}`,
    perPage: 1,
  });

  return getFirstListItem(payload);
};

const getExistingUpload = async (
  token: string,
  ownerId: string,
  roastBatchId: string,
): Promise<Record<string, unknown> | null> => {
  const payload = await listPocketBaseRecords(token, TRAINING_UPLOADS_COLLECTION, {
    fields: '*',
    filter: buildDuplicateUploadFilter(ownerId, roastBatchId),
    perPage: 1,
  });

  return getFirstListItem(payload);
};

const createPocketBaseRecord = async (
  token: string,
  collectionName: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const upstream = await proxyPocketBaseRequest(`/api/collections/${collectionName}/records`, {
    body: JSON.stringify(payload),
    headers: {
      Accept: 'application/json',
      Authorization: token,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!upstream.response.ok) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }

  if (!isRecord(upstream.payload)) {
    throw new PocketBaseGatewayError(502, { message: `${collectionName} 创建响应缺少必要字段。` });
  }

  return upstream.payload;
};

const parseRoastBatchIdFromBody = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }

  return toTrimmedString(payload.roastBatchId);
};

const buildStatus = async (
  token: string,
  ownerId: string,
  roastBatchId: string,
): Promise<TrainingUploadStatus> => {
  if (!isStagingAppEnv()) {
    return {
      alreadyUploaded: false,
      disabledReason: '正式环境暂未开放训练上传。',
      enabled: false,
      environment: 'production',
      roastBatchId,
    };
  }

  const existingUpload = await getExistingUpload(token, ownerId, roastBatchId);
  const batch = await getRecordById(token, ROAST_BATCHES_COLLECTION, roastBatchId);

  if (!batch) {
    return {
      alreadyUploaded: Boolean(existingUpload),
      disabledReason: '未找到这条烘焙记录。',
      enabled: false,
      environment: 'staging',
      roastBatchId,
      uploadId: toTrimmedString(existingUpload?.id) || undefined,
    };
  }

  const curve = await getCurveByBatchId(token, roastBatchId);
  const readiness = buildReadiness(batch, curve);

  return {
    alreadyUploaded: Boolean(existingUpload),
    disabledReason: existingUpload
      ? '这条烘焙记录已经上传过训练数据。'
      : readiness.isUploadReady
        ? undefined
        : `当前仍缺少：${readiness.missingLabels.join('、')}。`,
    enabled: !existingUpload && readiness.isUploadReady,
    environment: 'staging',
    readiness,
    roastBatchId,
    uploadId: toTrimmedString(existingUpload?.id) || undefined,
  };
};

const buildTrainingSnapshot = async (
  token: string,
  ownerId: string,
  roastBatch: Record<string, unknown>,
  roastCurve: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const greenBeanId = toTrimmedString(roastBatch.green_bean_id);
  const roastPlanId = toTrimmedString(roastBatch.roast_plan_id);
  const greenBean = await getRecordById(token, GREEN_BEANS_COLLECTION, greenBeanId);
  const roastPlan = await getRecordById(token, ROAST_PLANS_COLLECTION, roastPlanId);

  return {
    ownerId,
    capturedAt: new Date().toISOString(),
    schemaVersion: 1,
    roastBatch,
    roastCurve,
    greenBean,
    roastPlan,
  };
};

const handlePocketBaseError = (
  response: ServerResponse,
  error: unknown,
  fallbackMessage: string,
): void => {
  if (error instanceof PocketBaseGatewayError) {
    if (isOptionalCollectionMissing(error.status, error.payload)) {
      sendApiError(response, 424, '训练上传所需 PocketBase collection 尚未创建，请先完成测试库字段配置。');
      return;
    }

    sendApiError(response, error.status, normalizeErrorPayload(error.payload).message ?? fallbackMessage);
    return;
  }

  throw error;
};

export const handleRoastTrainingUploadStatus = async (
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<void> => {
  const authResponse = await refreshAuthenticatedSession(request, response);

  if (!authResponse) {
    return;
  }

  const roastBatchId = toTrimmedString(requestUrl.searchParams.get('roastBatchId'));

  if (!roastBatchId) {
    sendApiError(response, 400, '缺少烘焙记录 ID。');
    return;
  }

  try {
    const status = await buildStatus(authResponse.token, authResponse.record.id, roastBatchId);
    sendApiSuccess(response, status);
  } catch (error) {
    handlePocketBaseError(response, error, '训练上传状态读取失败。');
  }
};

export const handleRoastTrainingUpload = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  if (!isStagingAppEnv()) {
    sendApiError(response, 403, '正式环境暂未开放训练上传。');
    return;
  }

  const authResponse = await refreshAuthenticatedSession(request, response);

  if (!authResponse) {
    return;
  }

  const payload = await parseJsonBody(request);
  const roastBatchId = parseRoastBatchIdFromBody(payload);

  if (!roastBatchId) {
    sendApiError(response, 400, '缺少烘焙记录 ID。');
    return;
  }

  try {
    const existingUpload = await getExistingUpload(authResponse.token, authResponse.record.id, roastBatchId);

    if (existingUpload) {
      sendApiError(response, 409, '这条烘焙记录已经上传过训练数据，不能重复上传。', {
        uploadId: toTrimmedString(existingUpload.id),
      });
      return;
    }

    const roastBatch = await getRecordById(authResponse.token, ROAST_BATCHES_COLLECTION, roastBatchId);

    if (!roastBatch) {
      sendApiError(response, 404, '未找到这条烘焙记录。');
      return;
    }

    const roastCurve = await getCurveByBatchId(authResponse.token, roastBatchId);
    const readiness = buildReadiness(roastBatch, roastCurve);

    if (!readiness.isUploadReady || !roastCurve) {
      sendApiError(response, 422, `当前仍缺少：${readiness.missingLabels.join('、')}。`, {
        readiness,
      });
      return;
    }

    const snapshot = await buildTrainingSnapshot(authResponse.token, authResponse.record.id, roastBatch, roastCurve);
    const roasterModel =
      isRecord(snapshot.roastPlan) && hasText(snapshot.roastPlan.roaster_model)
        ? toTrimmedString(snapshot.roastPlan.roaster_model)
        : '其他';
    const samplePayload = {
      owner: authResponse.record.id,
      quality_status: 'pending',
      roast_batch_id: roastBatchId,
      roaster_model: roasterModel,
      snapshot,
    };
    const sample = await createPocketBaseRecord(authResponse.token, TRAINING_SAMPLES_COLLECTION, samplePayload);
    const qualityCheck = await checkAndUpdateRoastTrainingSampleQuality(authResponse.token, {
      ...samplePayload,
      id: toTrimmedString(sample.id),
    });
    const upload = await createPocketBaseRecord(authResponse.token, TRAINING_UPLOADS_COLLECTION, {
      owner: authResponse.record.id,
      roast_batch_id: roastBatchId,
      sample_id: toTrimmedString(sample.id),
      status: 'uploaded',
    });

    sendApiSuccess(response, {
      quality: qualityCheck,
      sampleId: toTrimmedString(sample.id),
      uploadId: toTrimmedString(upload.id),
    });
  } catch (error) {
    handlePocketBaseError(response, error, '训练上传失败。');
  }
};
