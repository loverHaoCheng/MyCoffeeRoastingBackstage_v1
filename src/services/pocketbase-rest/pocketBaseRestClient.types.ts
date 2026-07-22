export type Fetcher = typeof fetch;

export interface PocketBaseRestClientOptions {
  autoManageOwner?: boolean;
  autoManageTimestamps?: boolean;
  fetcher?: Fetcher;
  projectUrl: string;
  publishableKey?: string;
  timeoutMs?: number;
  useAuthGateway?: boolean;
}

export interface PocketBaseRestListOptions {
  expand?: string;
  limit?: number;
  match?: Record<string, boolean | number | string>;
  orderBy?: {
    ascending?: boolean;
    column: string;
  };
  select?: string;
}

export interface PocketBaseErrorPayload {
  code?: number | string;
  data?: unknown;
  message?: string;
}

export interface PocketBaseErrorFieldIssue {
  code?: string;
  message?: string;
}
