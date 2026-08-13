import type { IncomingMessage, ServerResponse } from 'node:http';

import { refreshAuthenticatedSession } from '../auth-common.js';
import {
  AI_FEATURE_ROAST_ANALYSIS,
  AI_FEATURE_ROAST_GENERAL_QUESTION,
  AI_FEATURE_ROAST_PLAN_RECOMMENDATION,
} from '../config.js';
import { sendApiError, sendApiSuccess } from '../http.js';
import { normalizeErrorPayload } from '../pocketbase-client.js';
import type { AiUsageState } from '../types.js';
import { PocketBaseGatewayError } from '../types.js';
import { toTrimmedString } from '../utils.js';
import {
  formatShanghaiMonth,
  getRequiredSuperuserToken,
  logAiRecognitionFailure,
  readAiUsageState,
  releaseAiUsageReservation,
  reserveAiUsage,
} from './usage-service.js';

export type RoastAiFeature =
  | typeof AI_FEATURE_ROAST_ANALYSIS
  | typeof AI_FEATURE_ROAST_GENERAL_QUESTION
  | typeof AI_FEATURE_ROAST_PLAN_RECOMMENDATION;

export interface RoastAiUsageContext {
  feature: RoastAiFeature;
  month: string;
  ownerId: string;
  state: AiUsageState;
  superuserToken: string;
  reservationLogId?: string;
}

export const roastAiFeatures: readonly RoastAiFeature[] = [
  AI_FEATURE_ROAST_ANALYSIS,
  AI_FEATURE_ROAST_GENERAL_QUESTION,
  AI_FEATURE_ROAST_PLAN_RECOMMENDATION,
];

export const isRoastAiFeature = (value: string): value is RoastAiFeature => {
  return roastAiFeatures.includes(value as RoastAiFeature);
};

const getFeatureLabel = (feature: RoastAiFeature): string => {
  switch (feature) {
    case AI_FEATURE_ROAST_ANALYSIS:
      return 'AI 曲线复盘';
    case AI_FEATURE_ROAST_GENERAL_QUESTION:
      return '咖啡常识性提问';
    case AI_FEATURE_ROAST_PLAN_RECOMMENDATION:
      return 'AI 推荐烘焙计划';
  }
};

export const readRoastAiUsageContext = async (
  ownerId: string,
  feature: RoastAiFeature,
): Promise<RoastAiUsageContext> => {
  const superuserToken = await getRequiredSuperuserToken();
  const month = formatShanghaiMonth(new Date());
  const state = await readAiUsageState(superuserToken, ownerId, feature, month);

  return {
    feature,
    month,
    ownerId,
    state,
    superuserToken,
  };
};

export const ensureRoastAiUsageAvailable = (context: RoastAiUsageContext): boolean => {
  const featureLabel = getFeatureLabel(context.feature);

  if (!context.state.enabled) {
    throw new PocketBaseGatewayError(403, {
      monthlyLimit: context.state.monthlyLimit,
      remainingUses: 0,
      usedThisMonth: context.state.usedThisMonth,
      message: `当前账号的${featureLabel}功能已关闭。`,
    });
  }

  if (context.state.remainingUses <= 0) {
    throw new PocketBaseGatewayError(429, {
      monthlyLimit: context.state.monthlyLimit,
      remainingUses: 0,
      usedThisMonth: context.state.usedThisMonth,
      message: `本月${featureLabel}次数已用完。`,
    });
  }

  return true;
};

export const reserveRoastAiUsage = async (context: RoastAiUsageContext): Promise<AiUsageState> => {
  const reservation = await reserveAiUsage(
    context.superuserToken,
    context.ownerId,
    context.feature,
    context.month,
  );

  context.reservationLogId = reservation.logId;
  context.state = reservation.state;
  return reservation.state;
};

export const logRoastAiUsageFailure = async (
  context: RoastAiUsageContext,
  errorMessage: string,
): Promise<void> => {
  await logAiRecognitionFailure(context.superuserToken, {
    errorMessage,
    feature: context.feature,
    month: context.month,
    ownerId: context.ownerId,
  });
};

export const releaseRoastAiUsageReservation = async (
  context: RoastAiUsageContext,
  errorMessage: string,
): Promise<void> => {
  if (!context.reservationLogId) {
    await logRoastAiUsageFailure(context, errorMessage);
    return;
  }

  await releaseAiUsageReservation(context.superuserToken, context.reservationLogId, errorMessage).catch(() => {
    // 保守保留无法释放的预占记录，避免并发请求突破额度上限。
  });
};

const sendUsageReadError = (response: ServerResponse, error: unknown): void => {
  const statusCode = error instanceof PocketBaseGatewayError ? error.status : 500;
  const message =
    error instanceof PocketBaseGatewayError
      ? normalizeErrorPayload(error.payload).message ?? error.message
      : 'AI 使用额度读取失败。';

  sendApiError(response, statusCode, message);
};

export const handleRoastAiUsage = async (
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<void> => {
  const authResponse = await refreshAuthenticatedSession(request, response);

  if (!authResponse) {
    return;
  }

  const feature = toTrimmedString(requestUrl.searchParams.get('feature'));

  if (!isRoastAiFeature(feature)) {
    sendApiError(response, 400, '缺少有效的烘焙 AI 功能码。');
    return;
  }

  try {
    const context = await readRoastAiUsageContext(authResponse.record.id, feature);
    sendApiSuccess(response, context.state);
  } catch (error) {
    sendUsageReadError(response, error);
  }
};
