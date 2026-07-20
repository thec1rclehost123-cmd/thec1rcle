import { track } from '@/lib/analytics';

export const FIRST_RUN_EVENTS = {
  APP_LAUNCH: 'first_run_app_launch',
  BOOTSTRAP_RESULT: 'first_run_bootstrap_result',
  LOGIN_VIEWED: 'first_run_login_viewed',
  AUTH_PROVIDER_SELECTED: 'first_run_auth_provider_selected',
  AUTH_RESULT: 'first_run_auth_result',
  STEP_VIEWED: 'first_run_step_viewed',
  STEP_COMPLETED: 'first_run_step_completed',
  STEP_FAILED: 'first_run_step_failed',
  STEP_BACKED_OUT: 'first_run_step_backed_out',
  LOCATION_RESULT: 'first_run_location_result',
  ONBOARDING_COMPLETED: 'first_run_onboarding_completed',
  EXPLORE_RENDERED: 'first_run_explore_rendered',
} as const;

export type FirstRunEvent = (typeof FIRST_RUN_EVENTS)[keyof typeof FIRST_RUN_EVENTS];

const ALLOWED_PROPERTIES = new Set([
  'stage',
  'provider',
  'outcome',
  'errorCode',
  'requestId',
  'countryCode',
  'ageBand',
  'cityId',
  'tasteCount',
  'tasteIds',
  'intentIds',
  'source',
  'feedSource',
  'latencyMs',
  'accountState',
  'bootstrapSource',
]);

const SENSITIVE_KEY =
  /(phone|email|otp|password|credential|token|dob|birth|latitude|longitude|coordinates?)/i;

function safeValue(value: unknown): string | number | boolean | string[] | undefined {
  if (typeof value === 'string') return value.slice(0, 120);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
    return value.slice(0, 20).map((entry) => entry.slice(0, 80));
  }
  return undefined;
}

export function sanitizeFirstRunProperties(properties: Record<string, unknown> = {}) {
  const sanitized: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(key) || SENSITIVE_KEY.test(key)) continue;
    const next = safeValue(value);
    if (next !== undefined) sanitized[key] = next;
  }
  return sanitized;
}

export function trackFirstRun(event: FirstRunEvent, properties: Record<string, unknown> = {}) {
  track(event, sanitizeFirstRunProperties(properties));
}
