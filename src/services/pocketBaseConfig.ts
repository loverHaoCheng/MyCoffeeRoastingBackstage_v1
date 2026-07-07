const DEFAULT_POCKETBASE_URL = 'http://81.70.224.75';

const isLegacyLocalHost = (value: string): boolean => {
  try {
    const url = new URL(value);

    return ['127.0.0.1', '::1', 'localhost'].includes(url.hostname);
  } catch {
    return false;
  }
};

const isLegacySupabaseHost = (value: string): boolean => {
  try {
    const url = new URL(value);

    return url.hostname === 'supabase.co' || url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

export const isSupabaseProjectUrl = (value: null | undefined | string): boolean => {
  const trimmed = value?.trim() ?? '';

  return trimmed.length > 0 && isLegacySupabaseHost(trimmed);
};

export const normalizePocketBaseBaseUrl = (value: null | undefined | string): string => {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return DEFAULT_POCKETBASE_URL;
  }

  if (isLegacySupabaseHost(trimmed)) {
    return DEFAULT_POCKETBASE_URL;
  }

  if (isLegacyLocalHost(trimmed)) {
    return DEFAULT_POCKETBASE_URL;
  }

  return trimmed.replace(/\/+$/, '');
};

export const normalizeSupabaseProjectUrl = (value: null | undefined | string): string => {
  return (value?.trim() ?? '').replace(/\/+$/, '');
};

export const resolvePocketBaseBaseUrl = (): string => {
  return normalizePocketBaseBaseUrl(import.meta.env.VITE_PB_URL ?? DEFAULT_POCKETBASE_URL);
};

export const resolvePocketBaseDashboardUrl = (): string => {
  return `${resolvePocketBaseBaseUrl()}/_/`;
};
