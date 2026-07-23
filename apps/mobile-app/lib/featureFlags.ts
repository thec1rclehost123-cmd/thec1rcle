/**
 * First-run release controls.
 *
 * Expo replaces EXPO_PUBLIC_* values at bundle time, so every key is referenced
 * explicitly. Unknown or missing values use the production-safe defaults below.
 * Setting any flag to "false", "0", "off", or "no" is an immediate rollback.
 */
export function parseFeatureFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  return defaultValue;
}

export type FirstRunFeatureFlags = Readonly<{
  firstRunV2Enabled: boolean;
  onboardingV2Required: boolean;
  exploreRecommendationsV2: boolean;
  contextualPermissionsEnabled: boolean;
  rolloutPercent: number;
  rolloutPlatforms: readonly string[];
}>;

function parsePercent(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : 100;
}

function parsePlatforms(value: string | undefined): readonly string[] {
  const platforms = (value || 'ios,android').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  return Object.freeze([...new Set(platforms)]);
}

export function readFirstRunFeatureFlags(): FirstRunFeatureFlags {
  return Object.freeze({
    firstRunV2Enabled: parseFeatureFlag(process.env.EXPO_PUBLIC_FIRST_RUN_V2_ENABLED, true),
    onboardingV2Required: parseFeatureFlag(process.env.EXPO_PUBLIC_ONBOARDING_V2_REQUIRED, true),
    exploreRecommendationsV2: parseFeatureFlag(process.env.EXPO_PUBLIC_EXPLORE_RECOMMENDATIONS_V2, true),
    contextualPermissionsEnabled: parseFeatureFlag(process.env.EXPO_PUBLIC_CONTEXTUAL_PERMISSIONS_ENABLED, true),
    rolloutPercent: parsePercent(process.env.EXPO_PUBLIC_FIRST_RUN_V2_PERCENT),
    rolloutPlatforms: parsePlatforms(process.env.EXPO_PUBLIC_FIRST_RUN_V2_PLATFORMS),
  });
}

export const firstRunFeatureFlags = readFirstRunFeatureFlags();

function rolloutBucket(subjectId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < subjectId.length; i += 1) {
    hash ^= subjectId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export type FirstRunRolloutContext = {
  /** Firebase UID or a random persisted install ID; it is hashed locally and never emitted. */
  subjectId?: string | null;
  platform?: string;
  internalAccount?: boolean;
};

/** A disabled/non-required v2 flow safely falls through to Explore. */
export function shouldEnforceFirstRunV2(
  flags = firstRunFeatureFlags,
  context: FirstRunRolloutContext = {},
): boolean {
  if (!flags.firstRunV2Enabled || !flags.onboardingV2Required) return false;
  if (context.internalAccount) return true;
  if (context.platform && !flags.rolloutPlatforms.includes(context.platform.toLowerCase())) return false;
  if (flags.rolloutPercent <= 0) return false;
  if (flags.rolloutPercent >= 100) return true;
  if (!context.subjectId) return false;
  return rolloutBucket(context.subjectId) < flags.rolloutPercent;
}
