import type { IncomingMessage, ServerResponse } from 'node:http';

import { getRequiredSuperuserToken } from './ai/usage-service.js';
import { authCollection } from './config.js';
import { sendJson } from './http.js';
import { normalizeErrorPayload, proxyPocketBaseRequest } from './pocketbase-client.js';
import { PocketBaseGatewayError } from './types.js';
import { isRecord, toTrimmedString } from './utils.js';

const UNVERIFIED_USER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface UnverifiedUserCandidate {
  createdAt: Date;
  id: string;
}

const isLoopbackRequest = (request: IncomingMessage): boolean => {
  const remoteAddress = request.socket.remoteAddress;

  return remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
};

const toCreatedAt = (value: unknown): Date | null => {
  const raw = toTrimmedString(value);

  if (!raw) {
    return null;
  }

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeCandidates = (payload: unknown): { candidates: UnverifiedUserCandidate[]; totalPages: number } => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new PocketBaseGatewayError(502, {
      message: '未验证用户列表响应缺少必要字段。',
    });
  }

  const totalPages = typeof payload.totalPages === 'number' && Number.isFinite(payload.totalPages) && payload.totalPages > 0
    ? Math.floor(payload.totalPages)
    : 1;
  const candidates = payload.items.flatMap((item) => {
    if (!isRecord(item) || item.verified === true) {
      return [];
    }

    const id = toTrimmedString(item.id);
    const createdAt = toCreatedAt(item.created);

    return id && createdAt ? [{ createdAt, id }] : [];
  });

  return { candidates, totalPages };
};

const listUnverifiedUserCandidates = async (superuserToken: string): Promise<UnverifiedUserCandidate[]> => {
  const candidates: UnverifiedUserCandidate[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const searchParams = new URLSearchParams({
      fields: 'id,created,verified',
      filter: 'verified = false',
      page: String(page),
      perPage: '200',
    });
    const upstream = await proxyPocketBaseRequest(
      `/api/collections/${authCollection}/records?${searchParams.toString()}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: superuserToken,
        },
        method: 'GET',
      },
    );

    if (!upstream.response.ok) {
      throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
    }

    const pageResult = normalizeCandidates(upstream.payload);
    candidates.push(...pageResult.candidates);
    totalPages = pageResult.totalPages;
    page += 1;
  } while (page <= totalPages);

  return candidates;
};

const deleteUser = async (superuserToken: string, userId: string): Promise<void> => {
  const upstream = await proxyPocketBaseRequest(`/api/collections/${authCollection}/records/${userId}`, {
    headers: {
      Accept: 'application/json',
      Authorization: superuserToken,
    },
    method: 'DELETE',
  });

  if (!upstream.response.ok && upstream.response.status !== 404) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }
};

export const handleUnverifiedUserCleanup = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  if (!isLoopbackRequest(request)) {
    sendJson(response, 403, {
      message: 'Forbidden',
    });
    return;
  }

  try {
    const superuserToken = await getRequiredSuperuserToken();
    const cutoff = new Date(Date.now() - UNVERIFIED_USER_MAX_AGE_MS);
    const candidates = await listUnverifiedUserCandidates(superuserToken);
    const expiredCandidates = candidates.filter((candidate) => candidate.createdAt.getTime() < cutoff.getTime());

    for (const candidate of expiredCandidates) {
      await deleteUser(superuserToken, candidate.id);
    }

    sendJson(response, 200, {
      cutoff: cutoff.toISOString(),
      deletedCount: expiredCandidates.length,
    });
  } catch (error) {
    const upstreamError = error instanceof PocketBaseGatewayError ? error : null;
    const message = upstreamError
      ? normalizeErrorPayload(upstreamError.payload).message ?? upstreamError.message
      : '未验证账号清理任务执行失败。';

    sendJson(response, upstreamError?.status ?? 500, {
      message,
    });
  }
};
