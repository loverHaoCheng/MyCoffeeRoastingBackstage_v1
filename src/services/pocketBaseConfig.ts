const LEGACY_POCKETBASE_PROTOCOL = 'http:';
const LEGACY_POCKETBASE_HOST = ['81', '70', '224', '75'].join('.');

const resolveBrowserSameOriginUrl = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  const origin = window.location.origin.trim();

  return origin === 'null' ? '' : origin;
};

const resolveDefaultPocketBaseUrl = (): string => {
  return resolveBrowserSameOriginUrl();
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

export const isLegacyPocketBaseDefaultUrl = (value: null | undefined | string): boolean => {
  const trimmed = value?.trim() ?? '';

  try {
    const url = new URL(trimmed);

    return url.protocol === LEGACY_POCKETBASE_PROTOCOL && url.host === LEGACY_POCKETBASE_HOST;
  } catch {
    return false;
  }
};

export const normalizePocketBaseBaseUrl = (value: null | undefined | string): string => {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return resolveDefaultPocketBaseUrl();
  }

  if (isLegacySupabaseHost(trimmed)) {
    return resolveDefaultPocketBaseUrl();
  }

  return trimmed.replace(/\/+$/, '');
};

export const normalizeSupabaseProjectUrl = (value: null | undefined | string): string => {
  return (value?.trim() ?? '').replace(/\/+$/, '');
};

export const resolvePocketBaseBaseUrl = (): string => {
  return normalizePocketBaseBaseUrl(import.meta.env.VITE_PB_URL);
};
