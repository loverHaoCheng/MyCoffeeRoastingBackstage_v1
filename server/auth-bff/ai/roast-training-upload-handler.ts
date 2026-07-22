import type { IncomingMessage, ServerResponse } from 'node:http';

import { refreshAuthenticatedSession } from '../auth-common.js';
import { isStagingAppEnv } from '../config.js';
import { parseJsonBody, sendApiError, sendApiSuccess } from '../http.js';
import { normalizeErrorPayload, proxyPocketBaseRequest } from '../pocketbase-client.js';
import { escapeFilterValue, getFirstListItem, isOptionalCollectionMissing, listPocketBaseRecords } from '../record-utils.js';
import { PocketBaseGatewayError } from '../types.js';
import { isRecord, toTrimmedString } from '../utils.js';
import { checkAndUpdateRoastTrainingSampleQuality, TRAINING_SAMPLES_COLLECTION } from './roast-training-quality-service.js';
import { requestRoastTrainingRecommendation } from './roast-training-recommendation-client.js';
import type {
  RoastPlanDraft,
  RoastTrainingRecommendationResult,
} from './roast-training-recommendation-types.js';

const TRAINING_UPLOADS_COLLECTION = 'roast_training_uploads';
const TRAINING_RECOMMENDATIONS_COLLECTION = 'ai_roast_recommendations';
const ROAST_BATCHES_COLLECTION = 'roast_batches';
const ROAST_CURVES_COLLECTION = 'roast_curve_records';
const ROAST_PLANS_COLLECTION = 'roast_profiles';
const ROASTING_MACHINES_COLLECTION = 'roasting_machines';
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
  recommendation?: TrainingRecommendationView;
  readiness?: TrainingReadiness;
  roastBatchId: string;
  uploadId?: string;
}

interface TrainingRecommendationView {
  adjustments: RoastTrainingRecommendationResult['adjustments'];
  confidence: number;
  modifiedPlanJson: RoastPlanDraft;
  recommendationId: string;
  overallReview: string;
  status: string;
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

const getTrainingRecommendationByBatchId = async (
  token: string,
  ownerId: string,
  roastBatchId: string,
  machineId: string,
): Promise<Record<string, unknown> | null> => {
  const filters = [`owner = ${escapeFilterValue(ownerId)}`];

  if (machineId) {
    filters.push(`machine_id = ${escapeFilterValue(machineId)}`);
  }

  const payload = await listPocketBaseRecords(token, TRAINING_RECOMMENDATIONS_COLLECTION, {
    fields: '*',
    filter: filters.join(' && '),
    perPage: 200,
  });
  const items = isRecord(payload) && Array.isArray(payload.items) ? payload.items.filter(isRecord) : [];

  return items.find((item) => {
    const context = isRecord(item.request_context) ? item.request_context : null;
    return toTrimmedString(context?.roastBatchId) === roastBatchId;
  }) ?? null;
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

const updatePocketBaseRecord = async (
  token: string,
  collectionName: string,
  recordId: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const upstream = await proxyPocketBaseRequest(`/api/collections/${collectionName}/records/${recordId}`, {
    body: JSON.stringify(payload),
    headers: {
      Accept: 'application/json',
      Authorization: token,
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  });

  if (!upstream.response.ok) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }

  if (!isRecord(upstream.payload)) {
    throw new PocketBaseGatewayError(502, { message: `${collectionName} 更新响应缺少必要字段。` });
  }

  return upstream.payload;
};

const parseRoastBatchIdFromBody = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }

  return toTrimmedString(payload.roastBatchId);
};

const parseRecommendationConfirmationBody = (
  payload: unknown,
): { confirmedPlanId: string; recommendationId: string } => {
  if (!isRecord(payload)) {
    return { confirmedPlanId: '', recommendationId: '' };
  }

  return {
    confirmedPlanId: toTrimmedString(payload.confirmedPlanId),
    recommendationId: toTrimmedString(payload.recommendationId),
  };
};

const toRecommendationPriority = (
  value: unknown,
): RoastTrainingRecommendationResult['adjustments'][number]['priority'] => {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
};

const toRecommendationView = (record: Record<string, unknown> | null): TrainingRecommendationView | undefined => {
  if (!record || !isRecord(record.plan_draft)) {
    return undefined;
  }

  const context = isRecord(record.request_context) ? record.request_context : {};
  const adjustments = Array.isArray(context.adjustments)
    ? context.adjustments.filter(isRecord).map((adjustment) => ({
        area: toTrimmedString(adjustment.area),
        expectedResult: toTrimmedString(adjustment.expectedResult ?? adjustment.expected_result),
        observation: toTrimmedString(adjustment.observation),
        priority: toRecommendationPriority(adjustment.priority),
        rationale: toTrimmedString(adjustment.rationale ?? adjustment.reason),
        suggestion: toTrimmedString(adjustment.suggestion),
      }))
    : [];
  const confidence = typeof context.confidence === 'number' && Number.isFinite(context.confidence)
    ? context.confidence
    : 0;

  return {
    adjustments,
    confidence,
    modifiedPlanJson: record.plan_draft as unknown as RoastPlanDraft,
    recommendationId: toTrimmedString(record.id),
    overallReview: toTrimmedString(context.overallReview),
    status: toTrimmedString(record.status),
  };
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
  const roastPlan = await getRecordById(token, ROAST_PLANS_COLLECTION, toTrimmedString(batch.roast_plan_id));
  const machineId = roastPlan ? toTrimmedString(roastPlan.roaster_machine_id) : '';
  const recommendation = await getTrainingRecommendationByBatchId(token, ownerId, roastBatchId, machineId);
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
    recommendation: toRecommendationView(recommendation),
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
  const roasterMachine = await getRecordById(
    token,
    ROASTING_MACHINES_COLLECTION,
    roastPlan ? toTrimmedString(roastPlan.roaster_machine_id) : '',
  );

  return {
    ownerId,
    capturedAt: new Date().toISOString(),
    schemaVersion: 1,
    roastCurveId: toTrimmedString(roastCurve.id),
    roastBatch,
    roastCurve,
    greenBean,
    roastPlan,
    roasterMachine,
  };
};

const getPlanStepText = (
  step: Record<string, unknown> | null,
  primaryKey: string,
  fallbackKey: string,
): string => {
  if (!step) {
    return '';
  }

  return toTrimmedString(step[primaryKey]) || toTrimmedString(step[fallbackKey]) || '';
};

const buildPlanDraftFromSnapshot = (snapshot: Record<string, unknown>): RoastPlanDraft => {
  const roastBatch = isRecord(snapshot.roastBatch) ? snapshot.roastBatch : {};
  const roastPlan = isRecord(snapshot.roastPlan) ? snapshot.roastPlan : {};
  const roasterMachine = isRecord(snapshot.roasterMachine) ? snapshot.roasterMachine : {};
  const greenBean = isRecord(snapshot.greenBean) ? snapshot.greenBean : {};
  const steps = Array.isArray(roastPlan.steps)
    ? roastPlan.steps
        .filter(isRecord)
        .slice(0, 12)
        .map((step) => ({
          airTemperature: getPlanStepText(step, 'airTemperature', 'air_temperature') || '-',
          drumSpeed: getPlanStepText(step, 'drumSpeed', 'drum_speed') || '-',
          event: getPlanStepText(step, 'event', 'eventName') || '节点',
          firePower: getPlanStepText(step, 'firePower', 'fire_power'),
          note: getPlanStepText(step, 'note', 'note'),
          operation: getPlanStepText(step, 'operation', 'operation') || '保持',
          temperature: getPlanStepText(step, 'temperature', 'drumTemperature') || '-',
          time: getPlanStepText(step, 'time', 'timeLabel') || '0:00',
        }))
    : [];

  return {
    batchWeightGrams:
      typeof roastPlan.batch_weight_grams === 'number' && Number.isFinite(roastPlan.batch_weight_grams)
        ? roastPlan.batch_weight_grams
        : typeof roastBatch.input_weight_grams === 'number' && Number.isFinite(roastBatch.input_weight_grams)
          ? roastBatch.input_weight_grams
          : 200,
    beanId: toTrimmedString(roastPlan.green_bean_id) || toTrimmedString(roastBatch.green_bean_id) || undefined,
    beanName:
      toTrimmedString(roastPlan.bean_name) ||
      toTrimmedString(roastBatch.green_bean_name) ||
      toTrimmedString(greenBean.name) ||
      '待选择生豆',
    name: `${toTrimmedString(roastPlan.name) || toTrimmedString(roastBatch.roast_plan_name) || 'AI 调整烘焙计划'}（建议版）`,
    purpose: toTrimmedString(roastPlan.roast_purpose) || toTrimmedString(roastBatch.roast_level) || undefined,
    roastLevel: toTrimmedString(roastPlan.target_roast_level) || toTrimmedString(roastBatch.roast_level) || '手冲浅烘',
    roasterMachineId: toTrimmedString(roastPlan.roaster_machine_id) || toTrimmedString(roasterMachine.id) || undefined,
    roasterModel:
      toTrimmedString(roasterMachine.display_name) ||
      toTrimmedString(roastPlan.roaster_model) ||
      toTrimmedString(roasterMachine.model_key) ||
      '',
    steps: steps.length > 0
      ? steps
      : [
          {
            airTemperature: '-',
            drumSpeed: '-',
            event: '入豆',
            firePower: '',
            note: '',
            operation: '入豆',
            temperature: '-',
            time: '0:00',
          },
        ],
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
    const basePlanDraft = buildPlanDraftFromSnapshot(snapshot);
    const recommendation = await requestRoastTrainingRecommendation({
      basePlanDraft,
      quality: null,
      snapshot,
    });
    const roasterModel =
      isRecord(snapshot.roasterMachine) && hasText(snapshot.roasterMachine.display_name)
        ? toTrimmedString(snapshot.roasterMachine.display_name)
        : '未关联烘焙机';
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
    const recommendationRecord = await createPocketBaseRecord(authResponse.token, TRAINING_RECOMMENDATIONS_COLLECTION, {
      generation_meta: {
        generatedAt: new Date().toISOString(),
        model: process.env.AI_ROAST_MODEL?.trim() ?? '',
        roastCurveId: toTrimmedString(roastCurve.id),
      },
      machine_id: recommendation.modifiedPlanJson.roasterMachineId ?? '',
      owner: authResponse.record.id,
      plan_draft: recommendation.modifiedPlanJson,
      request_context: {
        adjustments: recommendation.adjustments,
        confidence: recommendation.confidence,
        overallReview: recommendation.overallReview,
        quality: qualityCheck,
        roastBatchId,
        sampleId: toTrimmedString(sample.id),
        sourcePlanId: toTrimmedString(roastBatch.roast_plan_id),
      },
      status: 'draft',
    });
    const upload = await createPocketBaseRecord(authResponse.token, TRAINING_UPLOADS_COLLECTION, {
      owner: authResponse.record.id,
      roast_batch_id: roastBatchId,
      sample_id: toTrimmedString(sample.id),
      status: 'uploaded',
    });

    sendApiSuccess(response, {
      quality: qualityCheck,
      recommendation: toRecommendationView(recommendationRecord),
      sampleId: toTrimmedString(sample.id),
      uploadId: toTrimmedString(upload.id),
    });
  } catch (error) {
    handlePocketBaseError(response, error, '训练上传失败。');
  }
};

export const handleRoastTrainingRecommendationConfirm = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  if (!isStagingAppEnv()) {
    sendApiError(response, 403, '正式环境暂未开放 AI 计划确认。');
    return;
  }

  const authResponse = await refreshAuthenticatedSession(request, response);

  if (!authResponse) {
    return;
  }

  const payload = await parseJsonBody(request);
  const { confirmedPlanId, recommendationId } = parseRecommendationConfirmationBody(payload);

  if (!recommendationId || !confirmedPlanId) {
    sendApiError(response, 400, '缺少推荐记录 ID 或新建计划 ID。');
    return;
  }

  try {
    const recommendation = await getRecordById(
      authResponse.token,
      TRAINING_RECOMMENDATIONS_COLLECTION,
      recommendationId,
    );

    if (!recommendation) {
      sendApiError(response, 404, '未找到对应的 AI 推荐记录。');
      return;
    }

    const requestContext = isRecord(recommendation.request_context) ? recommendation.request_context : {};
    const generationMeta = isRecord(recommendation.generation_meta) ? recommendation.generation_meta : {};
    const updatedRecommendation = await updatePocketBaseRecord(
      authResponse.token,
      TRAINING_RECOMMENDATIONS_COLLECTION,
      recommendationId,
      {
        generation_meta: {
          ...generationMeta,
          confirmedAt: new Date().toISOString(),
          confirmedPlanId,
        },
        request_context: {
          ...requestContext,
          confirmedPlanId,
        },
        status: 'confirmed',
      },
    );

    sendApiSuccess(response, {
      recommendation: toRecommendationView(updatedRecommendation),
    });
  } catch (error) {
    handlePocketBaseError(response, error, 'AI 推荐确认失败。');
  }
};
