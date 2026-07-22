import type { IncomingMessage, ServerResponse } from 'node:http';

import { refreshAuthenticatedSession } from '../auth-common.js';
import { isStagingAppEnv } from '../config.js';
import { parseJsonBody, sendApiError, sendApiSuccess } from '../http.js';
import { normalizeErrorPayload, proxyPocketBaseRequest } from '../pocketbase-client.js';
import { escapeFilterValue, listPocketBaseRecords } from '../record-utils.js';
import { PocketBaseGatewayError } from '../types.js';
import { isRecord, toTrimmedString } from '../utils.js';
import { requestRoastPlanRecommendation } from './roast-plan-recommendation-client.js';
import type { RoastPlanDraft } from './roast-training-recommendation-types.js';

const GREEN_BEANS_COLLECTION = 'green_beans';
const AI_ROAST_PROFILES_COLLECTION = 'ai_roast_profiles';
const AI_ROAST_RECOMMENDATIONS_COLLECTION = 'ai_roast_recommendations';
const AI_ROAST_REVIEWS_COLLECTION = 'ai_roast_reviews';
const ROASTING_MACHINES_COLLECTION = 'roasting_machines';
const GENERIC_BEAN_ID = 'generic';
const GENERIC_BEAN_NAME = '通用';

interface RoastPlanRecommendationBody {
  batchWeightGrams: number;
  beanId: string;
  flavorExpectation: string;
  planName: string;
  purpose?: string;
  roastLevel: string;
  roasterMachineId: string;
}

type RoasterControlKey = 'airTemperature' | 'drumSpeed' | 'firePower';

const allControlKeys: RoasterControlKey[] = ['firePower', 'airTemperature', 'drumSpeed'];

const controlAliases: Record<RoasterControlKey, string[]> = {
  airTemperature: ['airtemperature', 'air_temperature', 'airtemp', 'windtemperature', '风温'],
  drumSpeed: ['drumspeed', 'drum_speed', 'rpm', 'rotation', '转速'],
  firePower: ['firepower', 'fire_power', 'gas', 'heat', 'power', '火力', '燃气'],
};

const toFinitePositiveNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseRecommendationBody = (payload: unknown): RoastPlanRecommendationBody | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const batchWeightGrams = toFinitePositiveNumber(payload.batchWeightGrams);
  const beanId = toTrimmedString(payload.beanId);
  const flavorExpectation = toTrimmedString(payload.flavorExpectation);
  const planName = toTrimmedString(payload.planName);
  const purpose = toTrimmedString(payload.purpose);
  const roastLevel = toTrimmedString(payload.roastLevel);
  const roasterMachineId = toTrimmedString(payload.roasterMachineId);

  if (!batchWeightGrams || !beanId || !flavorExpectation || !planName || !roastLevel || !roasterMachineId) {
    return null;
  }

  return {
    batchWeightGrams,
    beanId,
    flavorExpectation,
    planName,
    purpose: purpose || undefined,
    roastLevel,
    roasterMachineId,
  };
};

const normalizeControlText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim().toLowerCase().replaceAll(/\s/g, '') : '';
};

const flattenControlText = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(flattenControlText).join(' ');
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${key} ${flattenControlText(item)}`)
      .join(' ');
  }

  return normalizeControlText(value);
};

const getRoasterControlCapabilities = (machine: Record<string, unknown>): RoasterControlKey[] => {
  const configurationText = flattenControlText(machine.configuration);
  const configuredControls = allControlKeys.filter((control) => {
    return controlAliases[control].some((alias) => configurationText.includes(alias));
  });

  if (configuredControls.length > 0) {
    return configuredControls;
  }

  const machineText = `${normalizeControlText(machine.display_name)} ${normalizeControlText(machine.model_key)}`;

  if (machineText.includes('tank200d')) {
    return ['firePower'];
  }

  return allControlKeys;
};

const getListItems = (payload: unknown): Record<string, unknown>[] => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return [];
  }

  return payload.items.filter(isRecord);
};

const listOptionalAiRecords = async (
  token: string,
  collectionName: string,
  options: {
    fields: string;
    filter: string;
    perPage?: number;
    sort?: string;
  },
): Promise<Record<string, unknown>[]> => {
  try {
    return getListItems(await listPocketBaseRecords(token, collectionName, options));
  } catch (error) {
    if (error instanceof PocketBaseGatewayError) {
      // 机器记忆只是推荐增强项；集合未初始化、规则差异或旧环境字段差异都不能阻断 AI 计划生成。
      return [];
    }

    throw error;
  }
};

const compactReviewRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const result = isRecord(record.analysis_result) ? record.analysis_result : {};

  return {
    confidence: result.confidence,
    created: record.created,
    issues: result.issues,
    primaryAdjustment: result.primaryAdjustment,
    summary: result.summary,
  };
};

const compactRecommendationRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const context = isRecord(record.request_context) ? record.request_context : {};

  return {
    adjustments: context.adjustments,
    created: record.created,
    overallReview: context.overallReview,
    status: record.status,
  };
};

const compactProfileRecord = (record: Record<string, unknown>): Record<string, unknown> => ({
  confidence: record.confidence,
  evidenceCount: record.evidence_count,
  revision: record.revision,
  scope: record.scope,
  traits: record.traits,
  updated: record.updated,
});

const getMachineMemoryContext = async (
  token: string,
  ownerId: string,
  machine: Record<string, unknown>,
): Promise<{
  privateMachineProfile?: Record<string, unknown>;
  publicModelProfile?: Record<string, unknown>;
  recentRecommendations: Record<string, unknown>[];
  recentReviews: Record<string, unknown>[];
}> => {
  const machineId = toTrimmedString(machine.id);
  const modelKey = toTrimmedString(machine.model_key);
  const privateProfiles = machineId
    ? await listOptionalAiRecords(token, AI_ROAST_PROFILES_COLLECTION, {
        fields: 'scope,traits,evidence_count,confidence,revision,updated',
        filter: `scope = ${escapeFilterValue('private_machine')} && owner = ${escapeFilterValue(ownerId)} && machine_id = ${escapeFilterValue(machineId)}`,
        perPage: 1,
        sort: '-updated',
      })
    : [];
  const publicProfiles = modelKey
    ? await listOptionalAiRecords(token, AI_ROAST_PROFILES_COLLECTION, {
        fields: 'scope,traits,evidence_count,confidence,revision,updated',
        filter: `scope = ${escapeFilterValue('public_model')} && model_key = ${escapeFilterValue(modelKey)}`,
        perPage: 1,
        sort: '-updated',
      })
    : [];
  const recentReviews = machineId
    ? await listOptionalAiRecords(token, AI_ROAST_REVIEWS_COLLECTION, {
        fields: 'analysis_result,created',
        filter: `owner = ${escapeFilterValue(ownerId)} && machine_id = ${escapeFilterValue(machineId)}`,
        perPage: 3,
        sort: '-created',
      })
    : [];
  const recentRecommendations = machineId
    ? await listOptionalAiRecords(token, AI_ROAST_RECOMMENDATIONS_COLLECTION, {
        fields: 'request_context,status,created',
        filter: `owner = ${escapeFilterValue(ownerId)} && machine_id = ${escapeFilterValue(machineId)}`,
        perPage: 3,
        sort: '-created',
      })
    : [];

  return {
    ...(privateProfiles[0] ? { privateMachineProfile: compactProfileRecord(privateProfiles[0]) } : {}),
    ...(publicProfiles[0] ? { publicModelProfile: compactProfileRecord(publicProfiles[0]) } : {}),
    recentRecommendations: recentRecommendations.map(compactRecommendationRecord),
    recentReviews: recentReviews.map(compactReviewRecord),
  };
};

const getRecordById = async (
  token: string,
  collectionName: string,
  recordId: string,
): Promise<Record<string, unknown> | null> => {
  if (!recordId || recordId === GENERIC_BEAN_ID) {
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

const buildBasePlanDraft = (
  body: RoastPlanRecommendationBody,
  bean: Record<string, unknown> | null,
  machine: Record<string, unknown>,
): RoastPlanDraft => {
  const beanName =
    body.beanId === GENERIC_BEAN_ID
      ? GENERIC_BEAN_NAME
      : toTrimmedString(bean?.name) || toTrimmedString(bean?.display_name) || '待确认生豆';
  const roasterModel = toTrimmedString(machine.display_name) || toTrimmedString(machine.model_key) || '已关联烘焙机';
  const purpose = body.purpose ?? '手冲';

  return {
    batchWeightGrams: body.batchWeightGrams,
    beanId: body.beanId,
    beanName,
    name: body.planName,
    purpose,
    roastLevel: body.roastLevel,
    roasterMachineId: body.roasterMachineId,
    roasterModel,
    steps: [
      {
        airTemperature: '-',
        drumSpeed: '-',
        event: '入豆',
        firePower: '80%',
        note: '标明入豆炉温，并观察回温速度。',
        operation: '入豆并观察回温速度',
        temperature: '205°C',
        time: '0:00',
      },
      {
        airTemperature: '-',
        drumSpeed: '-',
        event: '转黄',
        firePower: '70%',
        note: '保持升温率平顺，避免前段过冲。',
        operation: '逐步降低火力并维持排湿',
        temperature: '150°C',
        time: '4:00~5:00',
      },
      {
        airTemperature: '-',
        drumSpeed: '-',
        event: '一爆开始',
        firePower: '55%',
        note: '根据一爆强度决定发展期热量。',
        operation: '降低火力，避免 RoR 断崖式下滑',
        temperature: '195°C',
        time: '7:00~8:30',
      },
      {
        airTemperature: '-',
        drumSpeed: '-',
        event: '下豆',
        firePower: '0%',
        note: '按目标烘焙度和风味预期确认发展时间。',
        operation: '达到目标发展后下豆冷却',
        temperature: '202°C',
        time: '8:30~10:00',
      },
    ],
  };
};

const lockPlanDraftToUserSelection = (
  draft: RoastPlanDraft,
  basePlanDraft: RoastPlanDraft,
  adjustableControls: RoasterControlKey[],
): RoastPlanDraft => {
  const isAirTemperatureAdjustable = adjustableControls.includes('airTemperature');
  const isDrumSpeedAdjustable = adjustableControls.includes('drumSpeed');
  const isFirePowerAdjustable = adjustableControls.includes('firePower');

  return {
    ...draft,
    batchWeightGrams: basePlanDraft.batchWeightGrams,
    beanId: basePlanDraft.beanId,
    beanName: basePlanDraft.beanName,
    name: basePlanDraft.name,
    purpose: basePlanDraft.purpose,
    roastLevel: basePlanDraft.roastLevel,
    roasterMachineId: basePlanDraft.roasterMachineId,
    roasterModel: basePlanDraft.roasterModel,
    steps: draft.steps.map((step) => ({
      ...step,
      airTemperature: isAirTemperatureAdjustable ? step.airTemperature : '不可调',
      drumSpeed: isDrumSpeedAdjustable ? step.drumSpeed : '不可调',
      firePower: isFirePowerAdjustable ? step.firePower : '不可调',
      temperature: step.temperature || '待确认炉温',
    })),
  };
};

const handlePocketBaseError = (
  response: ServerResponse,
  error: unknown,
  fallbackMessage: string,
): void => {
  if (error instanceof PocketBaseGatewayError) {
    sendApiError(response, error.status, normalizeErrorPayload(error.payload).message ?? fallbackMessage);
    return;
  }

  sendApiError(response, 502, error instanceof Error ? error.message : fallbackMessage);
};

export const handleRoastPlanRecommendation = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  if (!isStagingAppEnv()) {
    sendApiError(response, 403, '正式环境暂未开放 AI 烘焙计划推荐。');
    return;
  }

  const authResponse = await refreshAuthenticatedSession(request, response);

  if (!authResponse) {
    return;
  }

  const body = parseRecommendationBody(await parseJsonBody(request));

  if (!body) {
    sendApiError(response, 400, '请完整选择生豆、烘豆机，并填写批次重量、预期烘焙度和风味感受。');
    return;
  }

  try {
    const bean = body.beanId === GENERIC_BEAN_ID
      ? null
      : await getRecordById(authResponse.token, GREEN_BEANS_COLLECTION, body.beanId);
    const machine = await getRecordById(authResponse.token, ROASTING_MACHINES_COLLECTION, body.roasterMachineId);

    if (body.beanId !== GENERIC_BEAN_ID && !bean) {
      sendApiError(response, 404, '未找到所选生豆。');
      return;
    }

    if (!machine) {
      sendApiError(response, 404, '未找到所选烘豆机。');
      return;
    }

    const basePlanDraft = buildBasePlanDraft(body, bean, machine);
    const adjustableControls = getRoasterControlCapabilities(machine);
    const machineMemory = await getMachineMemoryContext(
      authResponse.token,
      authResponse.record.id,
      machine,
    );
    const recommendation = await requestRoastPlanRecommendation({
      basePlanDraft,
      bean,
      machine,
      machineControls: {
        adjustable: adjustableControls,
        readonly: allControlKeys.filter((control) => !adjustableControls.includes(control)),
      },
      machineMemory,
      target: {
        flavorExpectation: body.flavorExpectation,
        purpose: body.purpose,
        roastLevel: body.roastLevel,
      },
    });
    const lockedRecommendation = {
      ...recommendation,
      modifiedPlanJson: lockPlanDraftToUserSelection(recommendation.modifiedPlanJson, basePlanDraft, adjustableControls),
    };

    sendApiSuccess(response, {
      recommendation: lockedRecommendation,
    });
  } catch (error) {
    handlePocketBaseError(response, error, 'AI 烘焙计划推荐失败。');
  }
};
