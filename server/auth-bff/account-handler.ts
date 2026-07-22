import type { IncomingMessage, ServerResponse } from 'node:http';

import { getOptionalSuperuserToken } from './ai/usage-service.js';
import { sendUnverifiedResponse, toAccountDeletionResult } from './auth-common.js';
import { AI_USAGE_LIMITS_COLLECTION, AI_USAGE_LOGS_COLLECTION, authCollection } from './config.js';
import { clearAuthCookie, getAuthCookieValue, sendJson } from './http.js';
import { normalizeAuthResponse, proxyPocketBaseRequest, sendUpstreamError } from './pocketbase-client.js';
import { deleteRecordsByOwner } from './record-utils.js';
import { PocketBaseGatewayError } from './types.js';

export const handleDeleteAccount = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const token = getAuthCookieValue(request);

  if (!token) {
    clearAuthCookie(response, request);
    sendJson(response, 401, {
      message: '未找到登录态，请重新登录。',
    });
    return;
  }

  const sessionUpstream = await proxyPocketBaseRequest(`/api/collections/${authCollection}/auth-refresh`, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
    method: 'POST',
  });

  if (!sessionUpstream.response.ok) {
    clearAuthCookie(response, request);
    sendUpstreamError(response, sessionUpstream.response.status, sessionUpstream.payload);
    return;
  }

  const authResponse = normalizeAuthResponse(sessionUpstream.payload);

  if (!authResponse) {
    clearAuthCookie(response, request);
    sendJson(response, 502, {
      message: 'PocketBase 会话刷新响应缺少必要字段。',
    });
    return;
  }

  if (authResponse.record.verified !== true) {
    sendUnverifiedResponse(response, request, authResponse.record.email);
    return;
  }

  const deletionTargets: { filterField?: string; name: string; optional?: boolean }[] = [
    { name: 'finance_expense_records' },
    { name: 'finance_income_records', optional: true },
    { name: 'cost_calculations' },
    { name: 'coffee_beans', optional: true },
    { name: 'bean_sale_specs', optional: true },
    { name: 'roast_batches', optional: true },
    { name: 'roast_profiles' },
    { name: 'roast_records' },
    { name: 'green_bean_purchase_batches' },
    { name: 'green_beans' },
    { name: 'app_settings', optional: true },
    { name: 'ai_roast_consents', optional: true },
    { name: 'ai_roast_feedback', optional: true },
    { name: 'ai_roast_profiles', optional: true },
    { name: 'ai_roast_recommendations', optional: true },
    { name: 'ai_roast_reviews', optional: true },
    { name: 'roasting_machines', optional: true },
  ];

  try {
    for (const target of deletionTargets) {
      await deleteRecordsByOwner(authResponse.token, target.name, authResponse.record.id, {
        filterField: target.filterField,
        optional: target.optional,
      });
    }

    const optionalSuperuserToken = await getOptionalSuperuserToken();

    if (optionalSuperuserToken) {
      await deleteRecordsByOwner(optionalSuperuserToken, AI_USAGE_LOGS_COLLECTION, authResponse.record.id, {
        optional: true,
      });
      await deleteRecordsByOwner(optionalSuperuserToken, AI_USAGE_LIMITS_COLLECTION, authResponse.record.id, {
        optional: true,
      });
    }

    const deleteUserUpstream = await proxyPocketBaseRequest(
      `/api/collections/${authCollection}/records/${authResponse.record.id}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: authResponse.token,
        },
        method: 'DELETE',
      },
    );

    if (!deleteUserUpstream.response.ok && deleteUserUpstream.response.status !== 404) {
      sendUpstreamError(response, deleteUserUpstream.response.status, deleteUserUpstream.payload);
      return;
    }
  } catch (error) {
    const upstreamError =
      error instanceof PocketBaseGatewayError
        ? error
        : null;

    if (upstreamError) {
      sendUpstreamError(response, upstreamError.status, upstreamError.payload);
      return;
    }

    sendJson(response, 500, {
      message: '账号注销失败，请稍后重试。',
    });
    return;
  }

  clearAuthCookie(response, request);
  sendJson(response, 200, toAccountDeletionResult('账号已注销，所有关联数据已删除。'));
};
