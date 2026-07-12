export interface SessionUser {
  email: string;
  id: string;
  name?: string;
  verified?: boolean;
  username?: string;
}

export interface PocketBaseSessionResponse {
  record: SessionUser;
  token: string;
}

export interface ClientSessionResponse {
  record: SessionUser;
}

export interface PocketBaseErrorPayload {
  data?: Record<string, unknown>;
  message?: string;
}

export interface PocketBaseUserRecord {
  email?: unknown;
  id?: unknown;
  name?: unknown;
  verified?: unknown;
  username?: unknown;
}

export interface EmailActionResult {
  message: string;
  success: true;
}

export interface AccountDeletionResult {
  message: string;
  success: true;
}

export interface BeanImageRecognitionResult {
  altitudeMetersMax: null | number;
  altitudeMetersMin: null | number;
  code: string;
  densityGPerL: null | number;
  displayName: string;
  flavorTags: string[];
  grade: string;
  harvestSeason: string;
  millName: string;
  moisturePercent: null | number;
  notes: string;
  originArea: string;
  originCountry: string;
  originRegion: string;
  processMethod: string;
  supplierName: string;
  variety: string;
}

export class PocketBaseGatewayError extends Error {
  payload: unknown;
  status: number;

  constructor(status: number, payload: unknown, message?: string) {
    super(message ?? `PocketBase 请求失败：${String(status)}`);
    this.name = 'PocketBaseGatewayError';
    this.payload = payload;
    this.status = status;
  }
}

export interface PocketBaseListResponseItem {
  id?: unknown;
}

export interface AiUsageLimitRecord {
  enabled?: unknown;
  monthly_limit?: unknown;
}

export interface AiUsageState {
  enabled: boolean;
  monthlyLimit: number;
  remainingUses: number;
  usedThisMonth: number;
}
