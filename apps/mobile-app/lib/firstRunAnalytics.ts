import { track } from '@/lib/analytics';
import type { FirstRunStage } from '@/lib/firstRun';

export type FirstRunMetric =
  | 'app_launch_to_login'
  | 'auth_sync'
  | 'onboarding_step_save'
  | 'recommendation_request'
  | 'onboarding_to_explore'
  | 'explore_first_content'
  | 'login_video_first_frame';

export type FirstRunAnalyticsEvent =
  | 'first_run_app_launch'
  | 'first_run_login_viewed'
  | 'first_run_auth_started'
  | 'first_run_auth_succeeded'
  | 'first_run_auth_failed'
  | 'first_run_otp_sent'
  | 'first_run_otp_resent'
  | 'first_run_otp_verified'
  | 'first_run_otp_failed'
  | 'first_run_step_viewed'
  | 'first_run_step_completed'
  | 'first_run_completed'
  | 'first_run_explore_rendered'
  | 'first_run_legacy_redirected'
  | 'first_run_performance';

export type FirstRunAnalyticsProperties = {
  provider?: 'apple' | 'google' | 'phone' | 'email' | 'guest';
  mode?: 'sign_in' | 'link';
  stage?: FirstRunStage | 'login' | 'explore';
  source?: 'launch' | 'manual' | 'location' | 'legacy_deep_link' | 'onboarding';
  outcome?: 'success' | 'failure' | 'cancelled' | 'skipped';
  reason_code?: 'invalid_input' | 'provider_error' | 'network_or_server' | 'expired' | 'unknown';
  has_existing_session?: boolean;
  recommendation_source?: 'server' | 'local' | 'none';
  first_run_v2_enabled?: boolean;
  onboarding_v2_required?: boolean;
  metric?: FirstRunMetric;
  duration_ms?: number;
};

const BLOCKED_KEY = /(phone|email|dob|date.?of.?birth|coordinate|latitude|longitude|token|password|name|address|otp.?code|verification.?code|sms.?code)/i;
const SAFE_METRICS = new Set<FirstRunMetric>([
  'app_launch_to_login', 'auth_sync', 'onboarding_step_save', 'recommendation_request',
  'onboarding_to_explore', 'explore_first_content', 'login_video_first_frame',
]);

/** Runtime guard protects analytics even if a future caller bypasses TypeScript. */
export function sanitizeFirstRunAnalyticsProperties(
  properties: FirstRunAnalyticsProperties | Record<string, unknown> = {},
): Record<string, string | boolean | number> {
  const safe: Record<string, string | boolean | number> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (BLOCKED_KEY.test(key)) continue;
    if (typeof value === 'boolean') safe[key] = value;
    else if (key === 'metric' && typeof value === 'string' && SAFE_METRICS.has(value as FirstRunMetric)) safe[key] = value;
    else if (key !== 'metric' && typeof value === 'string' && value.length <= 64) safe[key] = value;
    else if (key === 'duration_ms' && typeof value === 'number' && Number.isFinite(value)) {
      safe[key] = Math.min(600_000, Math.max(0, Math.round(value)));
    }
  }
  return safe;
}

export function trackFirstRun(
  event: FirstRunAnalyticsEvent,
  properties: FirstRunAnalyticsProperties = {},
): void {
  track(event, sanitizeFirstRunAnalyticsProperties(properties));
}
