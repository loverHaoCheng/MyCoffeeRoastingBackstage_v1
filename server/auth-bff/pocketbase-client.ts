import type { ServerResponse } from 'node:http';

import { pocketBaseBaseUrl } from './config.js';
import { parseJsonResponse, sendJson } from './http.js';
import type { PocketBaseErrorPayload, PocketBaseListResponseItem, PocketBaseSessionResponse, PocketBaseUserRecord, SessionUser } from './types.js';
import { isRecord, toTrimmedString } from './utils.js';

export const buildPocketBaseUrl = (path: string): string => {
  return new URL(path, `${pocketBaseBaseUrl}/`).toString();
};

export const normalizeUser = (record: PocketBaseUserRecord): SessionUser | null => {
  const id = toTrimmedString(record.id);
  const email = toTrimmedString(record.email);

  if (!id || !email) {
    return null;
  }

  return {
    email,
    id,
    name: toTrimmedString(record.name) || undefined,
    verified: typeof record.verified === 'boolean' ? record.verified : undefined,
    username: toTrimmedString(record.username) || undefined,
  };
};

export const normalizeAuthResponse = (payload: unknown): PocketBaseSessionResponse | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const token = toTrimmedString(payload.token);
  const record = isRecord(payload.record) ? (payload.record as PocketBaseUserRecord) : null;

  if (!token || !record) {
    return null;
  }

  const user = normalizeUser(record);

  if (!user) {
    return null;
  }

  return {
    record: user,
    token,
  };
};

export const normalizeErrorPayload = (payload: unknown): PocketBaseErrorPayload => {
  if (!isRecord(payload)) {
    return {};
  }

  return {
    data: isRecord(payload.data) ? payload.data : undefined,
    message: toTrimmedString(payload.message) || undefined,
  };
};

export const normalizeListResponse = (payload: unknown): { items: { id: string }[]; totalPages: number } | null => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return null;
  }

  const items = payload.items
    .map((item) => {
      const record = isRecord(item) ? (item as PocketBaseListResponseItem) : null;
      const id = record ? toTrimmedString(record.id) : '';

      return id ? { id } : null;
    })
    .filter((item): item is { id: string } => item != null);
  const totalPages =
    typeof payload.totalPages === 'number' && Number.isFinite(payload.totalPages) && payload.totalPages > 0
      ? Math.floor(payload.totalPages)
      : 1;

  return {
    items,
    totalPages,
  };
};

export const sendUpstreamError = (response: ServerResponse, statusCode: number, payload: unknown): void => {
  const normalizedError = normalizeErrorPayload(payload);
  const message =
    normalizedError.message && normalizedError.message.length > 0
      ? normalizedError.message
      : `PocketBase 请求失败：${String(statusCode)}`;

  sendJson(response, statusCode, {
    ...normalizedError,
    message,
  });
};

export const proxyPocketBaseRequest = async (
  path: string,
  init: RequestInit,
): Promise<{ payload: unknown; response: Response }> => {
  const response = await fetch(buildPocketBaseUrl(path), init);
  const payload = await parseJsonResponse(response);

  return {
    payload,
    response,
  };
};
