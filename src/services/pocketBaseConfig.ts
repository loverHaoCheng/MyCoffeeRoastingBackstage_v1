const DEFAULT_POCKETBASE_URL = 'http://127.0.0.1:8090';

const isLegacySupabaseHost = (value: string): boolean => {
  try {
    const url = new URL(value);

    return url.hostname === 'supabase.co' || url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

export const normalizePocketBaseBaseUrl = (value: null | undefined | string): string => {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return DEFAULT_POCKETBASE_URL;
  }

  if (isLegacySupabaseHost(trimmed)) {
    return DEFAULT_POCKETBASE_URL;
  }

  return trimmed.replace(/\/+$/, '');
};

export const resolvePocketBaseBaseUrl = (): string => {
  return normalizePocketBaseBaseUrl(import.meta.env.VITE_PB_URL);
};

export const resolvePocketBaseDashboardUrl = (): string => {
  return `${resolvePocketBaseBaseUrl()}/_/`;
};
