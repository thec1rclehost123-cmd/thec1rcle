import {
  buildOnboardingBootstrap,
  normalizeAuthIdentity,
  onboardingConstants,
} from './onboarding-service.js';

export const ONBOARDING_V2_MIGRATION_VERSION = 2;
export const ONBOARDING_V2_MIGRATION_KEY = 'consumerOnboardingV2';

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

function valuesEqual(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function legacyCompletionIsTrue(data) {
  return (
    data?.onboardingComplete === true &&
    (data?.basicSetupComplete === true ||
      data?.profileSetupComplete === true ||
      data?.profileComplete === true)
  );
}

function canonicalCompatibilityPatch(data) {
  const displayName = data?.identity?.displayName || data?.displayName || data?.name;
  const dateOfBirth = data?.identity?.dateOfBirth || data?.dateOfBirth;
  const cityId = data?.discoveryProfile?.cityId || data?.cityId;
  const cityName = data?.discoveryProfile?.cityName || data?.city;
  const citySource = data?.discoveryProfile?.citySource;
  const vibeTags = Array.isArray(data?.discoveryProfile?.vibeTags)
    ? data.discoveryProfile.vibeTags
    : Array.isArray(data?.vibeTags)
      ? data.vibeTags
      : undefined;
  const intents = Array.isArray(data?.discoveryProfile?.intents)
    ? data.discoveryProfile.intents
    : Array.isArray(data?.intents)
      ? data.intents
      : undefined;

  const identity = compactObject({
    ...(data?.identity || {}),
    displayName: displayName ? String(displayName).trim() : undefined,
    dateOfBirth: dateOfBirth || undefined,
  });
  const discoveryProfile = compactObject({
    ...(data?.discoveryProfile || {}),
    cityId: cityId || undefined,
    cityName: cityName || undefined,
    citySource: citySource || undefined,
    vibeTags,
    intents,
    profileVersion: Number(data?.discoveryProfile?.profileVersion || 1),
  });

  return compactObject({
    identity: Object.keys(identity).length ? identity : undefined,
    discoveryProfile: Object.keys(discoveryProfile).length ? discoveryProfile : undefined,
  });
}

function cohortFor({ authRecordMissing, legacyComplete, grandfathered, stage }) {
  if (authRecordMissing) return 'orphaned_firestore_user';
  if (legacyComplete && grandfathered) return 'legacy_complete_grandfathered';
  if (legacyComplete && stage === 'phone_required') return 'legacy_complete_phone_required';
  if (stage === 'complete') return 'canonical_complete';
  return `incomplete_${stage}`;
}

/**
 * Pure migration classifier. It never performs database writes. `authRecord:
 * null` means Firebase Auth has no matching user; Firestore phone fields are
 * deliberately ignored and can never prove phone verification.
 */
export function classifyOnboardingV2Migration({ userId, data = {}, authRecord = null }) {
  if (!userId) throw new Error('userId is required');

  const marker = data?.migrations?.[ONBOARDING_V2_MIGRATION_KEY];
  const alreadyMigrated = Number(marker?.version || 0) >= ONBOARDING_V2_MIGRATION_VERSION;
  if (alreadyMigrated) {
    return {
      userId,
      cohort: 'already_migrated_v2',
      currentStage: data?.consumerOnboarding?.currentStage || 'unknown',
      firebasePhoneVerified: Boolean(authRecord?.phoneNumber || authRecord?.phone_number),
      legacyComplete: legacyCompletionIsTrue(data),
      proposedChanges: {},
      shouldApply: false,
    };
  }

  const compatibility = canonicalCompatibilityPatch(data);
  const candidateData = { ...data, ...compatibility };
  const authIdentity = normalizeAuthIdentity(userId, authRecord || {}, candidateData);
  const legacyComplete = legacyCompletionIsTrue(data);
  const firebasePhoneVerified = authIdentity.phoneVerified === true;
  const grandfathered = legacyComplete && firebasePhoneVerified;
  const bootstrap = buildOnboardingBootstrap(userId, candidateData, authRecord || {});
  const currentStage = grandfathered ? 'complete' : bootstrap.onboarding.currentStage;
  const consumerOnboarding = compactObject({
    ...(data.consumerOnboarding || {}),
    version: onboardingConstants.version,
    currentStage,
    completed: currentStage === 'complete',
    emailPromptStatus: bootstrap.onboarding.emailPromptStatus,
    startedAt: data.consumerOnboarding?.startedAt || data.createdAt || null,
    completedAt:
      currentStage === 'complete'
        ? data.consumerOnboarding?.completedAt || data.onboardingCompletedAt || null
        : null,
    legacyCompletionGrandfathered: grandfathered || undefined,
  });
  const proposedChanges = compactObject({ ...compatibility, consumerOnboarding });
  const effectiveChanges = Object.fromEntries(
    Object.entries(proposedChanges).filter(([key, value]) => !valuesEqual(data[key], value)),
  );
  const cohort = cohortFor({
    authRecordMissing: authRecord === null,
    legacyComplete,
    grandfathered,
    stage: currentStage,
  });

  return {
    userId,
    cohort,
    currentStage,
    firebasePhoneVerified,
    legacyComplete,
    proposedChanges: effectiveChanges,
    // Every unmarked document needs the apply-only audit marker, even when its
    // functional onboarding fields already match the v2 projection.
    shouldApply: true,
  };
}

export function buildOnboardingV2ApplyPatch(classification, existingData = {}, migratedAt) {
  if (!classification?.userId) throw new Error('classification.userId is required');
  if (!classification.shouldApply) return {};
  if (!migratedAt || Number.isNaN(Date.parse(migratedAt))) {
    throw new Error('A valid migratedAt ISO timestamp is required in apply mode');
  }

  return {
    ...classification.proposedChanges,
    consumerOnboarding: {
      ...(existingData.consumerOnboarding || {}),
      ...(classification.proposedChanges.consumerOnboarding || {}),
      updatedAt: migratedAt,
    },
    migrations: {
      ...(existingData.migrations || {}),
      [ONBOARDING_V2_MIGRATION_KEY]: {
        version: ONBOARDING_V2_MIGRATION_VERSION,
        migratedAt,
        cohort: classification.cohort,
      },
    },
    updatedAt: migratedAt,
  };
}

export const onboardingMigrationCohorts = [
  'already_migrated_v2',
  'orphaned_firestore_user',
  'legacy_complete_grandfathered',
  'legacy_complete_phone_required',
  'canonical_complete',
  'incomplete_phone_required',
  'incomplete_email_optional',
  'incomplete_identity',
  'incomplete_city',
  'incomplete_tastes',
  'incomplete_intent',
];
