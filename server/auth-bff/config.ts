export const DEFAULT_POCKETBASE_URL = 'http://127.0.0.1:8090';

export const DEFAULT_AUTH_COLLECTION = 'users';

export const DEFAULT_AUTH_COOKIE_NAME = 'easybake_pb_session';

export const DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const DEFAULT_PORT = 3001;

export const DEFAULT_SUPERUSER_COLLECTION = '_superusers';

export const DEFAULT_AI_USAGE_LIMIT = 10;

export const DEFAULT_AI_IMAGE_MAX_BYTES = 6 * 1024 * 1024;

export const EASYBAKE_APP_ENV_PRODUCTION = 'production';

export const EASYBAKE_APP_ENV_STAGING = 'staging';

export const AI_FEATURE_BEAN_IMAGE_RECOGNITION = 'bean_image_recognition';

export const AI_USAGE_LIMITS_COLLECTION = 'ai_usage_limits';

export const AI_USAGE_LOGS_COLLECTION = 'ai_usage_logs';

export const QINIU_DEFAULT_BASE_URL = 'https://api.qnaigc.com/v1';

export const QINIU_DEFAULT_MODEL = 'qwen/qwen3.6-27b';

export const AI_ROAST_DEFAULT_BASE_URL = 'https://api.qnaigc.com/v1';

export const AI_ROAST_DEFAULT_PROVIDER = 'qiniu';

export const BUSINESS_COLLECTIONS = new Set([
  'app_settings',
  'ai_roast_consents',
  'ai_roast_feedback',
  'ai_roast_profiles',
  'ai_roast_recommendations',
  'ai_roast_reviews',
  'bean_sale_specs',
  'cost_calculations',
  'finance_expense_records',
  'finance_income_records',
  'green_beans',
  'green_bean_purchase_batches',
  'roast_batches',
  'roast_curve_records',
  'roast_profiles',
  'roast_records',
  'roaster_models',
  'roasting_machines',
]);

export const REALTIME_SUBSCRIPTIONS = new Set([
  'app_settings/*',
  'ai_roast_consents/*',
  'ai_roast_feedback/*',
  'ai_roast_profiles/*',
  'ai_roast_recommendations/*',
  'ai_roast_reviews/*',
  'bean_sale_specs/*',
  'green_beans/*',
  'green_bean_purchase_batches/*',
  'roast_batches/*',
  'roast_curve_records/*',
  'roast_profiles/*',
  'roaster_models/*',
  'roasting_machines/*',
]);

export const normalizeBaseUrl = (value: string, fallback: string): string => {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed.replace(/\/+$/, '') : fallback;
};

export const authCollection = (process.env.PB_AUTH_COLLECTION ?? DEFAULT_AUTH_COLLECTION).trim() || DEFAULT_AUTH_COLLECTION;

export const superuserCollection =
  (process.env.PB_SUPERUSER_COLLECTION ?? DEFAULT_SUPERUSER_COLLECTION).trim() || DEFAULT_SUPERUSER_COLLECTION;

export const authCookieName =
  (process.env.PB_AUTH_COOKIE_NAME ?? DEFAULT_AUTH_COOKIE_NAME).trim() || DEFAULT_AUTH_COOKIE_NAME;

export const cookieMaxAgeCandidate = Number.parseInt(
  (process.env.PB_AUTH_COOKIE_MAX_AGE_SECONDS ?? String(DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS)).trim(),
  10,
);

export const cookieMaxAgeSeconds =
  Number.isFinite(cookieMaxAgeCandidate) && cookieMaxAgeCandidate >= 0
    ? cookieMaxAgeCandidate
    : DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS;

export const pocketBaseBaseUrl = normalizeBaseUrl(process.env.PB_BASE_URL ?? DEFAULT_POCKETBASE_URL, DEFAULT_POCKETBASE_URL);

export const portCandidate = Number.parseInt((process.env.PORT ?? String(DEFAULT_PORT)).trim(), 10);

export const port = Number.isFinite(portCandidate) && portCandidate > 0 ? portCandidate : DEFAULT_PORT;

export const getEasyBakeAppEnv = (): string => {
  return (process.env.EASYBAKE_APP_ENV ?? EASYBAKE_APP_ENV_PRODUCTION).trim().toLowerCase();
};

export const isStagingAppEnv = (): boolean => {
  return getEasyBakeAppEnv() === EASYBAKE_APP_ENV_STAGING;
};

export const aiImageMaxBytesCandidate = Number.parseInt(
  (process.env.AI_IMAGE_MAX_BYTES ?? String(DEFAULT_AI_IMAGE_MAX_BYTES)).trim(),
  10,
);

export const aiImageMaxBytes =
  Number.isFinite(aiImageMaxBytesCandidate) && aiImageMaxBytesCandidate > 0
    ? aiImageMaxBytesCandidate
    : DEFAULT_AI_IMAGE_MAX_BYTES;

export const qiniuQwenBaseUrl = normalizeBaseUrl(process.env.QINIU_QWEN_BASE_URL ?? QINIU_DEFAULT_BASE_URL, QINIU_DEFAULT_BASE_URL);

export const qiniuQwenModel = (process.env.QINIU_QWEN_MODEL ?? QINIU_DEFAULT_MODEL).trim() || QINIU_DEFAULT_MODEL;

export const aiRoastProvider =
  (process.env.AI_ROAST_PROVIDER ?? AI_ROAST_DEFAULT_PROVIDER).trim().toLowerCase() || AI_ROAST_DEFAULT_PROVIDER;

export const isSupportedAiRoastProvider = (): boolean => {
  return ['openai', 'openai-compatible', 'openai_compatible', 'qiniu'].includes(aiRoastProvider);
};

export const aiRoastBaseUrl = normalizeBaseUrl(
  process.env.AI_ROAST_BASE_URL ?? AI_ROAST_DEFAULT_BASE_URL,
  AI_ROAST_DEFAULT_BASE_URL,
);

export const aiRoastModel = (process.env.AI_ROAST_MODEL ?? '').trim();
